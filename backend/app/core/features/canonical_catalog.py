"""Canonical product feature keys (role toggles, sidebar, Team Management)."""

from __future__ import annotations

from typing import Iterable

# Stable keys for role `feature_keys[]` and Team Management toggles (order = UI sort).
CANONICAL_PRODUCT_FEATURES: tuple[str, ...] = (
    "dashboard",
    "monitoring",
    "logs_inspections",
    "inventory",
    "standards",
    "team_management",
    "team_insights",
    "equipment",
    "live_map",
    "zones_devices",
    "advertising_mapper",
    "xplor_indesign",
    "drawings",
    "schedule",
    "projects",
    "work_requests",
    "procedures",
    # Communications extras (system-admin contract; included in role toggles when on contract).
    "messaging",
    "comms_assets",
    "comms_publication_builder",
    "comms_campaign_planner",
)

_CANONICAL_SET = frozenset(CANONICAL_PRODUCT_FEATURES)

# Legacy DB / contract keys → canonical keys used on roles and in UI.
_LEGACY_TO_CANONICAL: dict[str, str] = {
    "compliance": "logs_inspections",
    "comms_advertising_mapper": "advertising_mapper",
    "comms_indesign_pipeline": "xplor_indesign",
}

# Canonical → legacy contract key stored in `company_features` until catalog migration completes.
_CANONICAL_TO_CONTRACT: dict[str, str] = {
    "logs_inspections": "compliance",
    "advertising_mapper": "comms_advertising_mapper",
    "xplor_indesign": "comms_indesign_pipeline",
    "standards": "procedures",
}


def to_canonical_feature_key(name: str) -> str | None:
    """Map a stored or legacy name to a canonical key, or None if unknown."""
    n = str(name).strip()
    if not n:
        return None
    if n in _CANONICAL_SET:
        return n
    mapped = _LEGACY_TO_CANONICAL.get(n)
    if mapped and mapped in _CANONICAL_SET:
        return mapped
    return None


def canonicalize_feature_keys(names: Iterable[str]) -> list[str]:
    out: set[str] = set()
    for raw in names:
        c = to_canonical_feature_key(str(raw))
        if c:
            out.add(c)
    return sorted(out)


def contract_keys_for_canonical(canonical_keys: Iterable[str]) -> list[str]:
    """Expand canonical role keys to `company_features` / GLOBAL_SYSTEM_FEATURES names."""
    out: set[str] = set()
    for c in canonicalize_feature_keys(canonical_keys):
        out.add(_CANONICAL_TO_CONTRACT.get(c, c))
    return sorted(out)


def canonical_keys_from_contract(names: Iterable[str]) -> list[str]:
    """Normalize tenant contract rows to canonical keys for role UI."""
    out: set[str] = set()
    for raw in names:
        c = to_canonical_feature_key(str(raw))
        if c:
            out.add(c)
            continue
        # Contract-only legacy names not in _LEGACY_TO_CANONICAL but valid catalog keys.
        n = str(raw).strip()
        if n in _CANONICAL_SET:
            out.add(n)
    return sorted(out)
