"""Tenant product-module visibility: system-admin contract + company-admin role matrix + per-user extras."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.workers_settings_merge import merge_workers_settings
from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.core.features.service import MODULE_KEYS
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkersSettings

from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

_FEATURE_CATALOG = frozenset(GLOBAL_SYSTEM_FEATURES)


def _contract_feature_names_normalized(raw: list[str]) -> list[str]:
    return sorted({f for f in raw if f in MODULE_KEYS or f in _FEATURE_CATALOG})


async def load_merged_workers_settings(db: AsyncSession, company_id: str) -> dict[str, Any]:
    q = await db.execute(select(PulseWorkersSettings).where(PulseWorkersSettings.company_id == company_id))
    row = q.scalar_one_or_none()
    return merge_workers_settings(row.settings if row else None)


def feature_access_role_bucket(user: User) -> str:
    if user_has_any_role(user, UserRole.manager):
        return "manager"
    if user_has_any_role(user, UserRole.supervisor):
        return "supervisor"
    if user_has_any_role(user, UserRole.lead):
        return "lead"
    return "worker"


def user_has_workers_roster_page_access(user: User, merged_settings: dict[str, Any]) -> bool:
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return True
    if user_has_any_role(user, UserRole.company_admin):
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
    merged_settings: dict[str, Any],
) -> list[str]:
    cset = set(contract_names)
    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return sorted(cset)
    if user_has_any_role(user, UserRole.company_admin):
        return sorted(cset)

    rfa = merged_settings.get("role_feature_access") or {}
    if not isinstance(rfa, dict):
        rfa = {}

    bucket = feature_access_role_bucket(user)
    raw_list = rfa.get(bucket)
    if raw_list is None:
        base_set = set(contract_names)
    elif not isinstance(raw_list, list):
        base_set = set(contract_names)
    else:
        base_set = set(str(x) for x in raw_list) & cset

    extras = getattr(user, "feature_allow_extra", None) or []
    if isinstance(extras, list):
        base_set |= {str(x) for x in extras if str(x) in cset}

    return sorted(base_set)


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
    eff = effective_tenant_feature_names_for_user(user=user, contract_names=contract, merged_settings=merged)
    roster = user_has_workers_roster_page_access(user, merged)
    admin_catalog = list(contract) if user_has_any_role(user, UserRole.company_admin) else []
    return contract, eff, roster, admin_catalog
