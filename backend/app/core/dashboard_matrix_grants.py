"""Implied dashboard surface keys for department × matrix-slot baselines."""

from __future__ import annotations

from app.core.features.canonical_catalog import CANONICAL_PRODUCT_FEATURES

_DASHBOARD_SURFACE_KEYS = frozenset(
    k for k in CANONICAL_PRODUCT_FEATURES if k == "dashboard" or k.startswith("dashboard_")
)

# Department baseline slot → dashboard flyout keys granted when `dashboard` is on contract.
_BASELINE_SLOT_DASHBOARD_GRANTS: dict[tuple[str, str], tuple[str, ...]] = {
    ("maintenance", "operations"): ("dashboard_operations",),
    ("communications", "coordination"): ("dashboard_dept_communications", "dashboard_operations"),
    ("reception", "coordination"): ("dashboard_dept_reception", "dashboard_operations"),
    ("aquatics", "aquatics_staff"): ("dashboard_dept_aquatics", "dashboard_operations"),
    ("fitness", "fitness_staff"): ("dashboard_dept_fitness", "dashboard_operations"),
    ("racquets", "racquets_staff"): ("dashboard_dept_racquets", "dashboard_operations"),
    ("admin", "admin_staff"): ("dashboard_dept_admin", "dashboard_operations"),
}


def matrix_feature_keys_allowed_in_settings() -> frozenset[str]:
    """Keys storable in ``department_role_feature_access`` (contract catalog + dashboard surfaces)."""
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    return frozenset(GLOBAL_SYSTEM_FEATURES) | _DASHBOARD_SURFACE_KEYS


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
    out = set(canonical_features)
    for key in grants:
        if key in contract_canonical:
            out.add(key)
    return sorted(out)
