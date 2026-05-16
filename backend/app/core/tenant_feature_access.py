"""Tenant product-module visibility: contract ∩ department × role-slot matrix (+ per-user extras)."""

from __future__ import annotations

from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.core.features.canonical_catalog import (
    CANONICAL_PRODUCT_FEATURES,
    canonical_keys_from_contract,
    canonicalize_feature_keys,
)
from app.core.features.service import MODULE_KEYS
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES, coerce_legacy_feature_names
from app.core.permission_feature_matrix import (
    PERMISSION_MATRIX_DEPARTMENTS,
    PERMISSION_MATRIX_SLOTS,
    permission_matrix_department_for_user,
    permission_matrix_slot_for_user,
)
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag, user_has_tenant_full_admin
from app.core.workers_settings_merge import merge_workers_settings
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR, PulseWorkersSettings
from app.models.rbac_models import TenantRole

_FEATURE_CATALOG = frozenset(GLOBAL_SYSTEM_FEATURES)


def _contract_feature_names_normalized(raw: list[str]) -> list[str]:
    return sorted({f for f in coerce_legacy_feature_names(raw) if f in MODULE_KEYS or f in _FEATURE_CATALOG})


async def load_merged_workers_settings(db: AsyncSession, company_id: str) -> dict[str, Any]:
    q = await db.execute(select(PulseWorkersSettings).where(PulseWorkersSettings.company_id == company_id))
    row = q.scalar_one_or_none()
    return merge_workers_settings(row.settings if row else None)


def tenant_full_admin_canonical_features(contract_names: list[str]) -> list[str]:
    """All canonical modules for tenant full admins (full contract, or full catalog if contract is empty)."""
    canonical = canonical_keys_from_contract(contract_names)
    if canonical:
        return canonical
    return list(CANONICAL_PRODUCT_FEATURES)


def _department_role_matrix_is_configured(matrix: object) -> bool:
    """True once any department row stores explicit slot lists (Team Management matrix)."""
    if not isinstance(matrix, dict):
        return False
    for d in PERMISSION_MATRIX_DEPARTMENTS:
        row = matrix.get(d)
        if not isinstance(row, dict):
            continue
        for s in PERMISSION_MATRIX_SLOTS:
            if s in row and isinstance(row[s], list):
                return True
    return False


def _features_from_department_role_matrix(
    *,
    user: User,
    hr: Any | None,
    merged_settings: dict[str, Any],
    contract_names: list[str],
) -> list[str] | None:
    """Sidebar modules from HR department × JWT slot matrix; None if matrix unused."""
    matrix = merged_settings.get("department_role_feature_access")
    if not _department_role_matrix_is_configured(matrix):
        return None
    assert isinstance(matrix, dict)
    dept = permission_matrix_department_for_user(user, hr)
    slot = permission_matrix_slot_for_user(user, hr)
    row = matrix.get(dept)
    feats: list[str] = []
    if isinstance(row, dict):
        raw = row.get(slot)
        if isinstance(raw, list):
            feats = [str(x) for x in raw]
    allowed_contract = set(canonical_keys_from_contract(contract_names))
    granted = set(canonicalize_feature_keys(feats))
    return sorted(granted & allowed_contract)


def _features_from_user_allow_extra(*, user: User, contract_names: list[str]) -> list[str]:
    raw = getattr(user, "feature_allow_extra", None) or []
    if not isinstance(raw, list):
        return []
    allowed = set(canonical_keys_from_contract(contract_names))
    granted = set(canonicalize_feature_keys(str(x) for x in raw if isinstance(x, str)))
    return sorted(granted & allowed)


def _sorted_canonical_union_contract_filtered(parts: Iterable[list[str]], *, contract_canonical: list[str]) -> list[str]:
    allowed = set(contract_canonical)
    merged: set[str] = set()
    for chunk in parts:
        merged |= set(canonicalize_feature_keys(chunk))
    return sorted(merged & allowed)


def _features_from_legacy_role_feature_access(
    *,
    user: User,
    merged_settings: dict[str, Any],
    contract_names: list[str],
) -> list[str]:
    """Fallback when the department matrix has never been persisted (`role_feature_access` buckets)."""
    rfa = merged_settings.get("role_feature_access") or {}
    if not isinstance(rfa, dict):
        return []
    bucket: str | None = None
    if user_has_any_role(user, UserRole.manager):
        bucket = "manager"
    elif user_has_any_role(user, UserRole.supervisor):
        bucket = "supervisor"
    elif user_has_any_role(user, UserRole.lead):
        bucket = "lead"
    elif user_has_any_role(user, UserRole.worker):
        bucket = "worker"
    if bucket is None:
        return []
    feats = rfa.get(bucket)
    if not isinstance(feats, list):
        return []
    allowed_contract = set(canonical_keys_from_contract(contract_names))
    granted = set(canonicalize_feature_keys(str(x) for x in feats))
    return sorted(granted & allowed_contract)


def user_has_workers_roster_page_access(user: User, merged_settings: dict[str, Any]) -> bool:
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return True
    if user_has_any_role(user, UserRole.demo_viewer) and user.company_id is not None:
        return True
    if user_has_any_role(user, UserRole.company_admin) or user_has_facility_tenant_admin_flag(user):
        return True
    deleg = merged_settings.get("workers_page_delegation") or {}
    if not isinstance(deleg, dict):
        deleg = {}
    if deleg.get("manager") is True and user_has_any_role(user, UserRole.manager):
        return True
    if deleg.get("supervisor") is True and user_has_any_role(user, UserRole.supervisor):
        return True
    if deleg.get("lead") is True and user_has_any_role(user, UserRole.lead):
        return True
    return False


def effective_tenant_feature_names_for_user(
    *,
    user: User,
    contract_names: list[str],
    merged_settings: dict[str, Any] | None = None,
    hr: Any | None = None,
    tenant_role: TenantRole | None = None,
) -> list[str]:
    """
    Canonical product keys for sidebar / ``enabled_features``.

    Precedence:

    - System / company / tenant full admins: full contract (canonicalized).
    - ``no_access`` access-overlay row (``tenant_roles.slug``): deny all regardless of matrix.
    - Else: department × role-slot matrix when configured, otherwise legacy ``role_feature_access`` buckets.
    - Union per-user ``feature_allow_extra`` (company-admin grants), ∩ contract.

    Tenant role ``feature_keys`` and synced ``tenant_role_grants`` do **not** widen module visibility —
    sidebar is matrix-driven (legacy fallback only until the matrix is configured).
    """
    contract_canonical = canonical_keys_from_contract(contract_names)
    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return contract_canonical
    if user_has_tenant_full_admin(user):
        return tenant_full_admin_canonical_features(contract_names)

    merged = merged_settings or {}

    if tenant_role is not None and tenant_role.slug == "no_access":
        return []

    matrix_feats = _features_from_department_role_matrix(
        user=user,
        hr=hr,
        merged_settings=merged,
        contract_names=contract_names,
    )
    if matrix_feats is not None:
        base_features = matrix_feats
    else:
        base_features = _features_from_legacy_role_feature_access(
            user=user,
            merged_settings=merged,
            contract_names=contract_names,
        )

    extras = _features_from_user_allow_extra(user=user, contract_names=contract_names)

    return _sorted_canonical_union_contract_filtered(
        [base_features, extras],
        contract_canonical=contract_canonical,
    )


async def contract_and_effective_features_for_me(
    db: AsyncSession,
    user: User,
) -> tuple[list[str], list[str], bool, list[str]]:
    """(contract_features, effective_nav_features, workers_roster_access, contract_for_admin_ui)."""
    if user.company_id is None:
        sa = bool(user.is_system_admin or user_has_any_role(user, UserRole.system_admin))
        return [], [], sa, []

    cid = str(user.company_id)
    raw = await tenant_enabled_feature_names_with_legacy(db, cid)
    contract = _contract_feature_names_normalized(raw)
    merged = await load_merged_workers_settings(db, cid)

    hr_me: PulseWorkerHR | None = None
    hr_row = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == user.id))
    hr_me = hr_row.scalar_one_or_none()

    tenant_role: TenantRole | None = None
    tr_id = getattr(user, "tenant_role_id", None)
    if tr_id:
        q = await db.execute(
            select(TenantRole).where(TenantRole.id == str(tr_id), TenantRole.company_id == cid)
        )
        tenant_role = q.scalar_one_or_none()

    eff = effective_tenant_feature_names_for_user(
        user=user,
        contract_names=contract,
        merged_settings=merged,
        hr=hr_me,
        tenant_role=tenant_role,
    )
    roster = user_has_workers_roster_page_access(user, merged)
    admin_catalog = list(contract) if user_has_tenant_full_admin(user) else []
    return contract, eff, roster, admin_catalog
