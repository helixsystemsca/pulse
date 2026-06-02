"""Who may edit work requests / facility zones — driven by `PulseWorkersSettings.settings` (merged)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.tenant_feature_access import contract_and_effective_features_for_me
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkRequest


def _role_set_from_setting(merged: dict[str, Any], key: str, *, default: list[str]) -> set[str]:
    raw = merged.get(key)
    if not isinstance(raw, list) or not raw:
        return set(default)
    out: set[str] = set()
    for x in raw:
        s = str(x).strip()
        if s:
            out.add(s)
    return out or set(default)


def user_may_edit_work_request(user: User, wr: PulseWorkRequest, merged_workers: dict[str, Any]) -> bool:
    """Company / system / facility tenant admins; creator; or any JWT role listed in `work_request_edit_roles`."""
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin, UserRole.company_admin):
        return True
    if user_has_facility_tenant_admin_flag(user):
        return True
    if wr.created_by_user_id and str(wr.created_by_user_id) == str(user.id):
        return True
    allow = _role_set_from_setting(
        merged_workers,
        "work_request_edit_roles",
        default=["manager", "supervisor"],
    )
    return bool(set(user.roles) & allow)


def user_may_manage_facility_zones(user: User, merged_workers: dict[str, Any]) -> bool:
    """Who may create/rename/delete zones used as work-request locations (`zone_manage_roles`)."""
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin, UserRole.company_admin):
        return True
    if user_has_facility_tenant_admin_flag(user):
        return True
    allow = _role_set_from_setting(
        merged_workers,
        "zone_manage_roles",
        default=["manager", "supervisor"],
    )
    return bool(set(user.roles) & allow)


async def user_may_manage_facility_zones_for_api(
    db: AsyncSession,
    user: User,
    merged_workers: dict[str, Any],
) -> bool:
    """
    Zone CRUD for facility locations (work requests + inventory settings).
    Allows legacy role lists, tenant admins, and RBAC `inventory.manage`.
    """
    if user_may_manage_facility_zones(user, merged_workers):
        return True
    contract_feats, eff_feats, _, _ = await contract_and_effective_features_for_me(db, user)
    resolved = set(
        await effective_rbac_permission_keys(
            db,
            user,
            contract_feature_names=contract_feats,
            effective_feature_names=eff_feats,
        )
    )
    return "*" in resolved or "inventory.manage" in resolved
