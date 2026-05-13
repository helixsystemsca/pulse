"""Canonical feature keys editable from the internal system admin dashboard."""

from __future__ import annotations

from typing import Iterable

# Stored when `sync_enabled_features` runs with zero catalog features so the tenant is not
# mistaken for a pre–feature-gates company (which has no rows and still gets legacy defaults).
TENANT_EMPTY_FEATURES_MARKER = "_tenant_empty_feature_canvas"

# Product-facing catalog (system admin UI). Order is mirrored in `frontend/lib/system-admin-features.ts`
# and grouped for Team Management in `frontend/config/platform/tenant-product-modules.ts`.
# (toggleable items only — not Dashboard or Settings).
# Keys must stay in sync with `frontend/lib/pulse-nav-features.ts` (classic nav) where applicable.
GLOBAL_SYSTEM_FEATURES: tuple[str, ...] = (
    "compliance",
    "schedule",
    "monitoring",
    "projects",
    "work_requests",
    "procedures",
    "team_insights",
    "team_management",
    "inventory",
    "equipment",
    "drawings",
    "zones_devices",
    "live_map",
    # Communications workspace (Team Management + system-admin contract; platform nav also checks these).
    "comms_assets",
    "comms_advertising_mapper",
    "comms_publication_builder",
    "comms_indesign_pipeline",
    "comms_campaign_planner",
    # Department workspace hubs (sidebar Workspaces + platform /{slug}/… routing visibility per role).
    "workspace_maintenance",
    "workspace_communications",
    "workspace_reception",
    "workspace_aquatics",
    "workspace_fitness",
    "workspace_admin",
)

_LEGACY_FEATURE_ALIASES: dict[str, tuple[str, ...]] = {
    # Old hub keys → granular nav modules
    "work_orders": ("work_requests", "procedures"),
    # Legacy `workers` row: roster page + team insights (historical mapping preserved)
    "workers": ("team_management", "team_insights"),
    "floor_plan": ("zones_devices",),
}

_GLOBAL_SET = frozenset(GLOBAL_SYSTEM_FEATURES)


def coerce_legacy_feature_names(names: Iterable[str]) -> list[str]:
    """Map legacy `company_features` rows to current catalog keys."""
    out: set[str] = set()
    for x in names:
        if x == TENANT_EMPTY_FEATURES_MARKER:
            continue
        mapped = _LEGACY_FEATURE_ALIASES.get(x)
        if mapped:
            out.update(y for y in mapped if y in _GLOBAL_SET)
            continue
        if x in _GLOBAL_SET:
            out.add(x)
    return sorted(out)


def normalize_enabled_features(requested: list[str]) -> list[str]:
    allowed = set(GLOBAL_SYSTEM_FEATURES)
    return sorted({f for f in requested if f in allowed})


def canonicalize_enabled_features_for_admin_ui(raw: list[str]) -> list[str]:
    """
    Map legacy `company_features` rows into the current catalog for system-admin checkboxes.
    """
    if not raw:
        return []
    if sorted(raw) == [TENANT_EMPTY_FEATURES_MARKER]:
        return []
    return coerce_legacy_feature_names(raw)


def expand_feature_name_for_usage_counts(fname: str) -> list[str]:
    """Expand a DB feature_name into zero or more catalog keys (system overview histogram)."""
    if fname == TENANT_EMPTY_FEATURES_MARKER:
        return []
    if fname in ("rtls_tracking", "tool_tracking"):
        return ["equipment"] if "equipment" in _GLOBAL_SET else []
    mapped = _LEGACY_FEATURE_ALIASES.get(fname)
    if mapped:
        return [k for k in mapped if k in _GLOBAL_SET]
    if fname in _GLOBAL_SET:
        return [fname]
    return []
