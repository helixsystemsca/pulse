"""Canonical product feature keys (role toggles, sidebar, Team Management)."""

from __future__ import annotations

from typing import Iterable

# Stable keys for role `feature_keys[]` and Team Management toggles (order = UI sort).
CANONICAL_PRODUCT_FEATURES: tuple[str, ...] = (
    "dashboard",
    "dashboard_operations",
    "dashboard_leadership",
    "dashboard_project",
    "dashboard_inspections",
    "dashboard_team_insights",
    "dashboard_dept_communications",
    "dashboard_dept_aquatics",
    "dashboard_dept_reception",
    "dashboard_dept_fitness",
    "dashboard_dept_racquets",
    "dashboard_dept_admin",
    "monitoring",
    "logs_inspections",
    "inventory",
    "inventory_scanner",
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
    "schedule_availability",
    "schedule_coverage",
    "schedule_shift_definitions",
    "projects",
    "project_management",
    "pm_workspace",
    "pm_planning",
    "work_requests",
    "procedures",
    "standards_training",
    "standards_certifications",
    "standards_compliance",
    "standards_my_procedures",
    "standards_routines",
    "standards_acknowledgments",
    "facilities_spatial",
    "spatial_infrastructure",
    # Communications extras (system-admin contract; included in role toggles when on contract).
    "messaging",
    "comms_assets",
    "comms_campaign_planner",
)

_CANONICAL_SET = frozenset(CANONICAL_PRODUCT_FEATURES)

# Legacy DB / contract keys → canonical keys used on roles and in UI.
_LEGACY_TO_CANONICAL: dict[str, str] = {
    "compliance": "logs_inspections",
    "comms_advertising_mapper": "advertising_mapper",
    "comms_indesign_pipeline": "xplor_indesign",
    "comms_publication_builder": "xplor_indesign",
}

# Canonical → legacy contract key stored in `company_features` until catalog migration completes.
_CANONICAL_TO_CONTRACT: dict[str, str] = {
    "dashboard_operations": "dashboard",
    "dashboard_leadership": "dashboard",
    "dashboard_project": "dashboard",
    "dashboard_inspections": "dashboard",
    "dashboard_team_insights": "dashboard",
    "dashboard_dept_communications": "dashboard",
    "dashboard_dept_aquatics": "dashboard",
    "dashboard_dept_reception": "dashboard",
    "dashboard_dept_fitness": "dashboard",
    "dashboard_dept_racquets": "dashboard",
    "dashboard_dept_admin": "dashboard",
    "logs_inspections": "compliance",
    "advertising_mapper": "comms_advertising_mapper",
    "xplor_indesign": "comms_indesign_pipeline",
    "standards": "procedures",
    "standards_training": "procedures",
    "standards_certifications": "procedures",
    "standards_compliance": "procedures",
    "standards_my_procedures": "procedures",
    "standards_routines": "procedures",
    "standards_acknowledgments": "procedures",
    "schedule_availability": "schedule",
    "schedule_coverage": "schedule",
    "schedule_shift_definitions": "schedule",
    "project_management": "projects",
    "pm_workspace": "projects",
    "pm_planning": "projects",
    "facilities_spatial": "drawings",
    "spatial_infrastructure": "drawings",
}

# Parent contract module → flyout keys licensable in Team Management (not auto-enabled).
_MATRIX_LICENSABLE_CHILDREN: dict[str, tuple[str, ...]] = {
    "schedule": (
        "schedule",
        "schedule_availability",
        "schedule_coverage",
        "schedule_shift_definitions",
    ),
    "projects": ("projects", "project_management", "pm_workspace", "pm_planning"),
    "procedures": (
        "procedures",
        "standards_training",
        "standards_certifications",
        "standards_compliance",
        "standards_my_procedures",
        "standards_routines",
        "standards_acknowledgments",
    ),
    "drawings": ("drawings", "facilities_spatial", "spatial_infrastructure"),
    "dashboard": tuple(k for k in CANONICAL_PRODUCT_FEATURES if k == "dashboard" or k.startswith("dashboard_")),
    "inventory": ("inventory", "inventory_scanner"),
}


def _expand_matrix_licensable_keys(names: Iterable[str]) -> set[str]:
    out: set[str] = set()
    for raw in names:
        t = str(raw).strip()
        if not t:
            continue
        out.add(t)
        children = _MATRIX_LICENSABLE_CHILDREN.get(t)
        if children:
            out.update(children)
    return out


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
    """Normalize tenant contract rows to canonical keys (includes flyout keys when parent module is licensed)."""
    out: set[str] = set()
    for raw in names:
        c = to_canonical_feature_key(str(raw))
        if c:
            out.add(c)
            continue
        n = str(raw).strip()
        if n in _CANONICAL_SET:
            out.add(n)
    for key in _expand_matrix_licensable_keys(names):
        c = to_canonical_feature_key(key)
        if c:
            out.add(c)
        elif key in _CANONICAL_SET:
            out.add(key)
    return sorted(out)
