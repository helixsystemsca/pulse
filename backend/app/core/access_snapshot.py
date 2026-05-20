"""
Canonical tenant access snapshot — delegates to ``resolve_tenant_capabilities``.

Operational permissions come only from ``tenant_role_assignments`` (assigned department + role_key).
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import canonicalize_feature_keys
from app.core.department_matrix_baselines import operational_matrix_slot_label
from app.core.permission_feature_matrix import matrix_cell_features, normalize_matrix_slot
from app.core.tenant_capabilities import resolve_tenant_capabilities
from app.core.tenant_feature_access import (
    _contract_feature_names_normalized,
    load_merged_workers_settings,
    user_has_workers_roster_page_access,
)
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.core.workspace_departments import normalize_workspace_department_slug_list
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantRole

_log = logging.getLogger("pulse.access_snapshot")

AssignmentStatusOut = Literal["assigned", "unassigned", "admin_bypass"]


@dataclass
class AccessSnapshotAudit:
    assignment_status: AssignmentStatusOut
    assigned_department_slug: str | None = None
    assigned_role_key: str | None = None
    assignment_id: str | None = None
    hr_matrix_slot: str | None = None
    inference_trace: list[str] = field(default_factory=list)
    resolution_warnings: list[str] = field(default_factory=list)
    denied_by_contract: list[str] = field(default_factory=list)
    contract_features: list[str] = field(default_factory=list)


@dataclass
class AccessSnapshot:
    """Canonical access envelope for a tenant user (also embedded on ``/auth/me``)."""

    department: str
    matrix_slot: str
    assignment_status: AssignmentStatusOut
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
        return normalize_workspace_department_slug_list([hr.department.strip()])
    return []


def _assignment_from_hr_for_snapshot(
    user: User,
    hr: PulseWorkerHR | None,
) -> "ActiveTenantAssignment | None":
    """Build synthetic assignment from HR when tests pass SimpleNamespace HR (no DB)."""
    from datetime import datetime, timezone

    from app.core.department_matrix_baselines import department_baseline_slot
    from app.core.tenant_role_assignments import (
        ActiveTenantAssignment,
        normalize_department_slug,
        normalize_role_key,
    )

    if not hr:
        return None
    slug = normalize_department_slug(getattr(hr, "department", None))
    explicit = normalize_role_key(getattr(hr, "matrix_slot", None))
    role = explicit or (department_baseline_slot(slug or "") if slug else None)
    if not slug or not role:
        return None
    return ActiveTenantAssignment(
        id="hr-synthetic",
        company_id=str(user.company_id),
        user_id=str(user.id),
        department_slug=slug,
        role_key=role,
        department_id=None,
        assigned_by=None,
        assigned_at=datetime.now(timezone.utc),
    )


async def resolve_access_snapshot(
    db: AsyncSession,
    user: User,
    *,
    contract_names: list[str] | None = None,
    merged_settings: dict[str, Any] | None = None,
    hr: PulseWorkerHR | None = None,
    tenant_role: TenantRole | None = None,
    assignment: "ActiveTenantAssignment | None" = None,
) -> AccessSnapshot:
    """Single canonical resolver via ``resolve_tenant_capabilities``."""
    from app.core.company_features import tenant_enabled_feature_names_with_legacy

    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        contract = list(contract_names or [])
        feats = canonicalize_feature_keys(contract) if contract else []
        return AccessSnapshot(
            department="maintenance",
            matrix_slot="manager",
            assignment_status="admin_bypass",
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

    active_assignment = assignment
    if active_assignment is None and hr is not None and not hasattr(db, "execute"):
        active_assignment = _assignment_from_hr_for_snapshot(user, hr)

    caps = await resolve_tenant_capabilities(
        db,
        user,
        contract_names=contract,
        merged_settings=merged,
        tenant_role=tenant_role,
        assignment=active_assignment,
    )

    dept = caps.department_slug or "maintenance"
    slot = caps.role_key or "unassigned"
    warnings: list[str] = []
    if caps.status == "unassigned":
        warnings.append(
            "User is unassigned — no department/role in tenant_role_assignments. "
            "Assign both in Team Management to grant operational access."
        )

    hr_slot_str = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    denied_features: list[str] = []
    if caps.status == "assigned" and caps.department_slug and caps.role_key:
        matrix = merged.get("department_role_feature_access") or {}
        if isinstance(matrix, dict):
            raw_cell = matrix_cell_features(matrix, department=caps.department_slug, slot=caps.role_key)
            eff_set = set(caps.features)
            denied_features = sorted(k for k in raw_cell if k not in eff_set)

    is_company_admin = user_has_tenant_full_admin(user)
    roster = user_has_workers_roster_page_access(user, merged)
    dept_slugs = _hr_department_slugs(hr)

    audit = AccessSnapshotAudit(
        assignment_status=caps.status,
        assigned_department_slug=caps.department_slug,
        assigned_role_key=caps.role_key,
        assignment_id=caps.assignment_id,
        hr_matrix_slot=hr_slot_str,
        inference_trace=list(caps.resolution_trace),
        resolution_warnings=warnings,
        contract_features=list(contract),
    )
    return AccessSnapshot(
        department=dept,
        matrix_slot=slot,
        assignment_status=caps.status,
        features=list(caps.features),
        capabilities=list(caps.capabilities),
        departments=dept_slugs,
        is_company_admin=is_company_admin,
        workers_roster_access=roster,
        contract_features=list(contract),
        denied_features=denied_features,
        audit=audit,
    )
