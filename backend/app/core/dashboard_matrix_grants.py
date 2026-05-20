"""Implied dashboard surface keys for department × matrix-slot baselines."""

from __future__ import annotations

from typing import Iterable

from app.core.features.canonical_catalog import (
    CANONICAL_PRODUCT_FEATURES,
    canonicalize_feature_keys,
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
    contract_names: Iterable[str] | None = None,
) -> list[str]:
    """
    Inject baseline dashboard flyout keys for department × matrix-slot pairs.

    - Matrix cell lists a flyout key explicitly → grant that flyout.
    - Tenant contract explicitly names a flyout (e.g. ``dashboard_operations``) → grant for the slot.
    - Parent ``dashboard`` on the matrix row does **not** auto-expand to dept flyouts (Team Management
      toggles are authoritative).
    """
    if "dashboard" not in contract_canonical:
        return canonical_features
    grants = _BASELINE_SLOT_DASHBOARD_GRANTS.get((department, slot))
    if not grants:
        return canonical_features
    feature_set = set(canonical_features)
    explicit_contract = (
        set(canonicalize_feature_keys(contract_names))
        if contract_names is not None
        else set()
    )
    out = set(canonical_features)
    for key in grants:
        if key in feature_set or key in explicit_contract:
            out.add(key)
    return sorted(out)
