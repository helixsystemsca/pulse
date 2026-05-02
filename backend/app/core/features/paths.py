"""Map HTTP paths to canonical module feature keys for middleware gating."""

from __future__ import annotations

# String = single required feature; tuple = any one of (OR).
FeatureRequirement = str | tuple[str, ...]

# Longest prefix first so more specific paths win.
_MODULE_PATH_PREFIXES: tuple[tuple[str, FeatureRequirement], ...] = (
    ("/api/v1/gateways/status", "zones_devices"),
    ("/api/v1/gateways", "zones_devices"),
    ("/api/v1/ble-devices/unknown", "zones_devices"),
    ("/api/v1/ble-devices", "zones_devices"),
    ("/api/v1/zones", "zones_devices"),
    # Shared prefix: device hub list vs PM tasks under same `/tools` segment — allow either module.
    ("/api/v1/tools", ("equipment", "zones_devices")),
    ("/api/v1/pulse/schedule", "schedule"),
    ("/api/v1/cmms", ("work_requests", "procedures")),
    ("/api/work-requests", "work_requests"),
    ("/api/v1/maintenance", ("work_requests", "procedures")),
    ("/api/v1/projects", "projects"),
    ("/api/v1/tasks", "projects"),
    ("/api/v1/proximity", "projects"),
    ("/api/v1/operations", "projects"),
    ("/api/compliance", "compliance"),
    ("/api/v1/equipment", "equipment"),
    ("/api/v1/tool-tracking", "equipment"),
    ("/api/inventory", "inventory"),
    ("/api/v1/inventory", "inventory"),
    ("/api/blueprints", "drawings"),
    ("/api/maps", "drawings"),
    ("/api/assets", "drawings"),
    ("/api/connections", "drawings"),
    ("/api/attributes", "drawings"),
    ("/api/trace-route", "drawings"),
    ("/api/v1/team", "team_insights"),
    ("/api/v1/gamification", "team_insights"),
    ("/api/v1/monitoring", "monitoring"),
    ("/api/v1/telemetry", "live_map"),
)


def required_feature_for_path(path: str) -> FeatureRequirement | None:
    """
    Return the module key(s) required to access this path, or None if not module-scoped.

    Core routes (auth, admin, core ingest, ws, docs) are not gated here.
    """
    normalized = path if path == "/" else path.rstrip("/")
    for prefix, key in _MODULE_PATH_PREFIXES:
        if normalized == prefix or normalized.startswith(prefix + "/"):
            return key
    return None
