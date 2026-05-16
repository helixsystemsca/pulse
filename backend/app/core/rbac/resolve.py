"""Resolve flat RBAC permission keys for a user (DB grants or legacy feature bridge)."""

from __future__ import annotations

from typing import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import canonical_keys_from_contract, contract_keys_for_canonical
from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS, RBAC_KEY_REQUIRES_COMPANY_FEATURE
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
    - Else: bridge ``effective_feature_names`` ∪ ``feature_allow_extra`` duplicate merge (same as sidebar), ∩ contract.

      ``effective_feature_names`` follows the department × matrix (or legacy buckets). ``tenant_role_grants``
      synced from overlay rows intentionally do **not** expand this bridge (keeps API gates aligned with
      ``enabled_features``).
    - When ``effective_feature_names`` is empty and the user has no ``tenant_role_id``: bridge full contract as a
      migration fallback.
    - When ``effective_feature_names`` is empty and ``tenant_role_id`` is set: bridge only extras / empty (never the
      full contract shortcut).
    """
    _ = db  # async signature parity with callers
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
            return sorted(_filter_keys_by_contract(bridged_eff, contract_feature_names))
        contract_canonical = canonical_keys_from_contract(contract_feature_names)
        bridged = rbac_keys_from_legacy_effective_features(contract_canonical)
        return sorted(_filter_keys_by_contract(bridged, contract_feature_names))

    return sorted(_filter_keys_by_contract(bridged_eff, contract_feature_names))
