"""
Canonical tenant access snapshot — single resolver for matrix → features → capabilities.

Delegates to production helpers in ``tenant_feature_access`` and ``rbac.resolve``; does not add rules.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import canonicalize_feature_keys
from app.core.matrix_slot_policy import (
    detect_likely_elevated_worker,
    log_inferred_elevated_worker,
    matrix_slot_fallback_warning_message,
    recommend_explicit_matrix_slot,
    require_explicit_elevated_slots,
    resolve_matrix_slot_detailed,
)
from app.core.permission_feature_matrix import (
    MatrixSlotSource,
    matrix_slot_resolution_warnings,
    normalize_matrix_slot,
    permission_matrix_department_for_user,
    permission_matrix_slot_for_user,
)
from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.tenant_feature_access import (
    _contract_feature_names_normalized,
    _features_from_department_role_matrix,
    effective_tenant_feature_names_for_user,
    load_merged_workers_settings,
    user_has_workers_roster_page_access,
)
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.core.workspace_departments import normalize_workspace_department_slug_list
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantRole

_log = logging.getLogger("pulse.access_snapshot")


@dataclass
class AccessSnapshotAudit:
    matrix_slot_source: MatrixSlotSource
    matrix_slot_inferred: bool
    hr_matrix_slot: str | None
    likely_elevated: bool = False
    likely_elevated_reasons: list[str] = field(default_factory=list)
    recommended_matrix_slot: str | None = None
    inference_trace: list[str] = field(default_factory=list)
    require_explicit_elevated_slots: bool = False
    resolution_warnings: list[str] = field(default_factory=list)
    denied_by_contract: list[str] = field(default_factory=list)
    contract_features: list[str] = field(default_factory=list)


@dataclass
class AccessSnapshot:
    """Canonical access envelope for a tenant user (also embedded on ``/auth/me``)."""

    department: str
    matrix_slot: str
    features: list[str]
    capabilities: list[str]
    departments: list[str]
    is_company_admin: bool
    workers_roster_access: bool = False
    contract_features: list[str] = field(default_factory=list)
    denied_features: list[str] = field(default_factory=list)
    audit: AccessSnapshotAudit | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _hr_department_slugs(hr: PulseWorkerHR | None) -> list[str]:
    if not hr:
        return []
    raw = getattr(hr, "department_slugs", None)
    if isinstance(raw, list) and raw:
        return normalize_workspace_department_slug_list([str(x) for x in raw])
    if hr.department:
        one = normalize_workspace_department_slug_list([hr.department.strip()])
        return one
    return []


def _denied_features_for_audit(
    *,
    user: User,
    hr: PulseWorkerHR | None,
    merged_settings: dict[str, Any],
    contract_names: list[str],
    effective_features: list[str],
) -> tuple[list[str], list[str]]:
    """(denied_by_contract, denied_features for snapshot)."""
    raw_matrix = _features_from_department_role_matrix(
        user=user,
        hr=hr,
        merged_settings=merged_settings,
        contract_names=contract_names,
    )
    if raw_matrix is None:
        return [], []

    dept = permission_matrix_department_for_user(user, hr)
    slot = permission_matrix_slot_for_user(user, hr)
    matrix = merged_settings.get("department_role_feature_access") or {}
    raw_cell: list[str] = []
    if isinstance(matrix, dict):
        row = matrix.get(dept)
        if isinstance(row, dict):
            cell = row.get(slot)
            if isinstance(cell, list):
                raw_cell = [str(x) for x in cell]

    raw_canon = set(canonicalize_feature_keys(raw_cell))
    eff_set = set(canonicalize_feature_keys(effective_features))
    allowed_contract = set(canonicalize_feature_keys(contract_names))
    denied_contract = sorted(k for k in raw_canon if k not in allowed_contract)
    denied_not_granted = sorted(k for k in raw_canon if k in allowed_contract and k not in eff_set)
    return denied_contract, denied_not_granted


async def resolve_access_snapshot(
    db: AsyncSession,
    user: User,
    *,
    contract_names: list[str] | None = None,
    merged_settings: dict[str, Any] | None = None,
    hr: PulseWorkerHR | None = None,
    tenant_role: TenantRole | None = None,
) -> AccessSnapshot:
    """
    Single canonical resolver: matrix department + slot → features → capabilities.

    ``contract_names`` / ``merged_settings`` / ``hr`` may be preloaded (e.g. from ``/auth/me``).
    """
    from app.core.company_features import tenant_enabled_feature_names_with_legacy

    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        contract = list(contract_names or [])
        feats = canonicalize_feature_keys(contract) if contract else []
        return AccessSnapshot(
            department="maintenance",
            matrix_slot="manager",
            features=sorted(feats),
            capabilities=["*"],
            departments=[],
            is_company_admin=True,
            workers_roster_access=True,
            contract_features=contract,
        )

    cid = str(user.company_id)
    if contract_names is None:
        raw = await tenant_enabled_feature_names_with_legacy(db, cid)
        contract = _contract_feature_names_normalized(raw)
    else:
        contract = list(contract_names)

    merged = merged_settings if merged_settings is not None else await load_merged_workers_settings(db, cid)

    if hr is None:
        hr_row = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == user.id))
        hr = hr_row.scalar_one_or_none()

    if tenant_role is None:
        tr_id = getattr(user, "tenant_role_id", None)
        if tr_id:
            q = await db.execute(
                select(TenantRole).where(TenantRole.id == str(tr_id), TenantRole.company_id == cid)
            )
            tenant_role = q.scalar_one_or_none()

    dept = permission_matrix_department_for_user(user, hr)
    slot_detail = resolve_matrix_slot_detailed(user, hr)
    slot = slot_detail.slot
    slot_source = slot_detail.source
    explicit_hr_slot = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    hr_slot_str = explicit_hr_slot

    elevated, elev_reasons = detect_likely_elevated_worker(user, hr)
    recommended = recommend_explicit_matrix_slot(user, hr, elevated_reasons=elev_reasons)
    inference_trace = list(slot_detail.inference_trace)

    warnings = matrix_slot_resolution_warnings(
        user, hr, resolved_slot=slot, resolved_slot_source=slot_source
    )
    fallback_msg = matrix_slot_fallback_warning_message(resolved_slot=slot, source=slot_source)
    if fallback_msg:
        warnings.insert(0, fallback_msg)
    if elevated and slot_source != "explicit_matrix_slot":
        warnings.insert(
            0,
            "LIKELY ELEVATED WORKER using inferred access rules — assign explicit matrix_slot on HR profile.",
        )

    if slot_source != "explicit_matrix_slot":
        _log.warning(
            "matrix_slot inferred user_id=%s company_id=%s department=%s slot=%s source=%s hr_matrix_slot=%r job_title=%r",
            user.id,
            user.company_id,
            dept,
            slot,
            slot_source,
            hr_slot_str,
            slot_detail.effective_job_title,
        )
    log_inferred_elevated_worker(
        user=user,
        hr=hr,
        department=dept,
        resolved_slot=slot,
        source=slot_source,
        elevated_reasons=elev_reasons,
    )

    is_company_admin = user_has_tenant_full_admin(user)
    eff = effective_tenant_feature_names_for_user(
        user=user,
        contract_names=contract,
        merged_settings=merged,
        hr=hr,
        tenant_role=tenant_role,
    )
    caps = await effective_rbac_permission_keys(
        db,
        user,
        contract_feature_names=contract,
        effective_feature_names=eff,
    )
    roster = user_has_workers_roster_page_access(user, merged)
    dept_slugs = _hr_department_slugs(hr)
    denied_contract, denied_features = _denied_features_for_audit(
        user=user,
        hr=hr,
        merged_settings=merged,
        contract_names=contract,
        effective_features=eff,
    )

    audit = AccessSnapshotAudit(
        matrix_slot_source=slot_source,
        matrix_slot_inferred=slot_source != "explicit_matrix_slot",
        hr_matrix_slot=hr_slot_str,
        likely_elevated=elevated,
        likely_elevated_reasons=elev_reasons,
        recommended_matrix_slot=recommended,
        inference_trace=inference_trace,
        require_explicit_elevated_slots=require_explicit_elevated_slots(),
        resolution_warnings=warnings,
        denied_by_contract=denied_contract,
        contract_features=list(contract),
    )

    return AccessSnapshot(
        department=dept,
        matrix_slot=slot,
        features=list(eff),
        capabilities=list(caps),
        departments=dept_slugs,
        is_company_admin=is_company_admin,
        workers_roster_access=roster,
        contract_features=list(contract),
        denied_features=sorted(set(denied_features) | set(denied_contract)),
        audit=audit,
    )
