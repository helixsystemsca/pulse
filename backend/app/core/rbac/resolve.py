"""Resolve flat RBAC permission keys for a user (DB grants or legacy feature bridge)."""

from __future__ import annotations

from typing import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import canonical_keys_from_contract, contract_keys_for_canonical
from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS, RBAC_KEY_REQUIRES_COMPANY_FEATURE
from app.core.tenant_feature_access import load_merged_workers_settings
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.domain import User, UserRole


def _contract_set(names: Iterable[str]) -> set[str]:
    return {str(x) for x in names if x}


def _expanded_contract_set(names: Iterable[str]) -> set[str]:
    """Legacy + canonical contract keys for RBAC ∩ contract checks."""
    raw = _contract_set(names)
    expanded: set[str] = set(raw)
    for c in canonical_keys_from_contract(names):
        expanded.update(contract_keys_for_canonical([c]))
    return expanded


def _filter_keys_by_contract(keys: set[str], contract_names: Iterable[str]) -> set[str]:
    contract = _expanded_contract_set(contract_names)
    if not contract:
        return set()
    out: set[str] = set()
    for k in keys:
        req = RBAC_KEY_REQUIRES_COMPANY_FEATURE.get(k)
        if req is None:
            continue
        if req in contract:
            out.add(k)
    return out


def rbac_keys_from_legacy_effective_features(effective_features: Iterable[str]) -> set[str]:
    keys: set[str] = set()
    for feat in effective_features:
        for key in (str(feat), *contract_keys_for_canonical([str(feat)])):
            mapped = FEATURE_TO_RBAC_PERMISSIONS.get(key)
            if mapped:
                keys.update(mapped)
    return keys


def _work_request_edit_roles_from_settings(merged: dict) -> set[str]:
    raw = merged.get("work_request_edit_roles")
    if not isinstance(raw, list) or not raw:
        return {"manager", "supervisor"}
    out = {str(x).strip() for x in raw if str(x).strip()}
    return out or {"manager", "supervisor"}


async def _apply_rbac_extras_and_delegation(
    db: AsyncSession,
    user: User,
    keys: set[str],
    contract_feature_names: list[str],
) -> set[str]:
    """Union per-user bypass keys and tenant work-request edit delegation."""
    keys = _filter_keys_by_contract(keys, contract_feature_names)

    rbac_extra = getattr(user, "rbac_permission_extra", None) or []
    if isinstance(rbac_extra, list):
        keys |= {str(x) for x in rbac_extra if isinstance(x, str) and str(x).strip()}
    keys = _filter_keys_by_contract(keys, contract_feature_names)

    if user.company_id and "work_requests.view" in keys and "work_requests.edit" not in keys:
        merged = await load_merged_workers_settings(db, str(user.company_id))
        allow = _work_request_edit_roles_from_settings(merged)
        if set(user.roles or []) & allow:
            keys.add("work_requests.edit")
        keys = _filter_keys_by_contract(keys, contract_feature_names)

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

    - System administrators: ``["*"]``.
    - Tenant full admins (``company_admin`` / ``facility_tenant_admin``): ``["*"]``.
    - Else: bridge ``effective_feature_names`` ∪ ``feature_allow_extra`` (view-level keys for modules).
    - Plus ``rbac_permission_extra`` per-user bypass keys.
    - ``work_requests.edit`` added when JWT role matches ``work_request_edit_roles`` in workers settings.
    """
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return ["*"]
    if user.company_id is None:
        return []

    if user_has_tenant_full_admin(user):
        return ["*"]

    eff = list(effective_feature_names)
    extras = getattr(user, "feature_allow_extra", None) or []
    if isinstance(extras, list):
        eff = sorted(set(eff) | {str(x) for x in extras if isinstance(x, str)})
    bridged_eff = rbac_keys_from_legacy_effective_features(eff)

    if not effective_feature_names:
        if getattr(user, "tenant_role_id", None):
            keys = await _apply_rbac_extras_and_delegation(db, user, bridged_eff, contract_feature_names)
            return sorted(keys)
        contract_canonical = canonical_keys_from_contract(contract_feature_names)
        bridged = rbac_keys_from_legacy_effective_features(contract_canonical)
        keys = await _apply_rbac_extras_and_delegation(db, user, bridged, contract_feature_names)
        return sorted(keys)

    keys = await _apply_rbac_extras_and_delegation(db, user, bridged_eff, contract_feature_names)
    return sorted(keys)
