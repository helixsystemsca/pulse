"""Implied dashboard surface keys for department × matrix-slot baselines."""

from __future__ import annotations

from app.core.features.canonical_catalog import (
    CANONICAL_PRODUCT_FEATURES,
    _CANONICAL_TO_CONTRACT,
    to_canonical_feature_key,
)

_DASHBOARD_SURFACE_KEYS = frozenset(
    k for k in CANONICAL_PRODUCT_FEATURES if k == "dashboard" or k.startswith("dashboard_")
)

# Department baseline slot → dashboard flyout keys granted when `dashboard` is on contract.
_BASELINE_SLOT_DASHBOARD_GRANTS: dict[tuple[str, str], tuple[str, ...]] = {
    ("maintenance", "operations"): ("dashboard_operations",),
    ("communications", "coordination"): ("dashboard_dept_communications",),
    ("reception", "coordination"): ("dashboard_dept_reception", "dashboard_operations"),
    ("aquatics", "aquatics_staff"): ("dashboard_dept_aquatics", "dashboard_operations"),
    ("fitness", "fitness_staff"): ("dashboard_dept_fitness", "dashboard_operations"),
    ("racquets", "racquets_staff"): ("dashboard_dept_racquets", "dashboard_operations"),
    ("admin", "admin_staff"): ("dashboard_dept_admin", "dashboard_operations"),
}


def matrix_feature_keys_allowed_in_settings() -> frozenset[str]:
    """Keys storable in ``department_role_feature_access`` (catalog + flyout matrix keys + legacy names)."""
    from app.core.features.canonical_catalog import _LEGACY_TO_CANONICAL
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    return (
        frozenset(GLOBAL_SYSTEM_FEATURES)
        | frozenset(CANONICAL_PRODUCT_FEATURES)
        | frozenset(_LEGACY_TO_CANONICAL.keys())
    )


def augment_canonical_dashboard_grants(
    department: str,
    slot: str,
    canonical_features: list[str],
    *,
    contract_canonical: frozenset[str] | set[str],
) -> list[str]:
    """
    When the tenant has ``dashboard`` on contract, inject baseline dashboard surface keys
  for frontline matrix slots (e.g. maintenance operations → operations dashboard only).
    """
    if "dashboard" not in contract_canonical:
        return canonical_features
    grants = _BASELINE_SLOT_DASHBOARD_GRANTS.get((department, slot))
    if not grants:
        return canonical_features
    contract_set = set(contract_canonical)
    out = set(canonical_features)
    for key in grants:
        if key in contract_set:
            out.add(key)
            continue
        # Tenant contracts often store only the parent module (`dashboard`), not each flyout key.
        parent_contract = _CANONICAL_TO_CONTRACT.get(key)
        if parent_contract:
            parent_canonical = to_canonical_feature_key(parent_contract)
            if parent_canonical and parent_canonical in contract_set:
                out.add(key)
    return sorted(out)
