"""Resolve flat RBAC permission keys for a user (DB grants or legacy feature bridge)."""

from __future__ import annotations

from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS, RBAC_KEY_REQUIRES_COMPANY_FEATURE
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag
from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRoleGrant


def _contract_set(names: Iterable[str]) -> set[str]:
    return {str(x) for x in names if x}


def _filter_keys_by_contract(keys: set[str], contract: set[str]) -> set[str]:
    out: set[str] = set()
    for k in keys:
        req = RBAC_KEY_REQUIRES_COMPANY_FEATURE.get(k)
        if req is None:
            if any(w for w in contract if w.startswith("workspace_")):
                out.add(k)
            continue
        if req in contract:
            out.add(k)
    return out


def rbac_keys_from_legacy_effective_features(effective_features: Iterable[str]) -> set[str]:
    keys: set[str] = set()
    for feat in effective_features:
        mapped = FEATURE_TO_RBAC_PERMISSIONS.get(str(feat))
        if mapped:
            keys.update(mapped)
    return keys


async def effective_rbac_permission_keys(
    db: AsyncSession,
    user: User,
    *,
    contract_feature_names: list[str],
    effective_feature_names: list[str],
) -> list[str]:
    """
    Effective flat permission keys for UI + route checks.

    - System administrators: `["*"]`.
    - Tenant full admins: all catalog keys allowed by the company contract.
    - Users with `tenant_role_id`: union of `tenant_role_grants` ∩ contract.
    - Else: bridge from legacy effective product feature names (matrix / `role_feature_access`).
    """
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return ["*"]
    if user.company_id is None:
        return []

    contract = _contract_set(contract_feature_names)

    if user_has_any_role(user, UserRole.company_admin) or user_has_facility_tenant_admin_flag(user):
        keys = set(RBAC_KEY_REQUIRES_COMPANY_FEATURE.keys())
        return sorted(_filter_keys_by_contract(keys, contract))

    tr_id = getattr(user, "tenant_role_id", None)
    if tr_id:
        q = await db.execute(
            select(TenantRoleGrant.permission_key).where(TenantRoleGrant.tenant_role_id == str(tr_id))
        )
        raw = {str(r[0]) for r in q.all()}
        return sorted(_filter_keys_by_contract(raw, contract))

    bridged = rbac_keys_from_legacy_effective_features(effective_feature_names)
    return sorted(_filter_keys_by_contract(bridged, contract))
