"""Tenant product-module visibility: contract (system admin) × tenant role `feature_keys`."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.core.features.canonical_catalog import CANONICAL_PRODUCT_FEATURES, canonical_keys_from_contract
from app.core.features.service import MODULE_KEYS
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES, coerce_legacy_feature_names
from app.core.tenant_roles import effective_features_from_role
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag, user_has_tenant_full_admin
from app.core.workers_settings_merge import merge_workers_settings
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkersSettings
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
    Canonical product keys for sidebar / `enabled_features`.

    - System / company admins: full contract (canonicalized).
    - Users with `tenant_role`: role `feature_keys` ∩ contract.
    - Everyone else: empty (default deny).
    """
    _ = merged_settings, hr  # departments are metadata only; matrix retired.
    contract_canonical = canonical_keys_from_contract(contract_names)
    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return contract_canonical
    if user_has_tenant_full_admin(user):
        return tenant_full_admin_canonical_features(contract_names)

    tr_id = getattr(user, "tenant_role_id", None)
    if tenant_role is not None or tr_id:
        return effective_features_from_role(tenant_role, contract_names=contract_names)
    return []


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
        tenant_role=tenant_role,
    )
    roster = user_has_workers_roster_page_access(user, merged)
    admin_catalog = list(contract) if user_has_tenant_full_admin(user) else []
    return contract, eff, roster, admin_catalog
