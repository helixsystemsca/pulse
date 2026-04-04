"""Map HTTP paths to canonical module feature keys for middleware gating."""

# Longest prefix first so `/api/v1/jobs-extra` would not match before we add such routes.
_MODULE_PATH_PREFIXES: tuple[tuple[str, str], ...] = (
    ("/api/blueprints", "maintenance"),
    ("/api/v1/pulse/schedule", "schedule"),
    ("/api/v1/projects", "projects"),
    ("/api/v1/tasks", "projects"),
    ("/api/v1/proximity", "projects"),
    ("/api/v1/operations", "projects"),
    ("/api/compliance", "compliance"),
    ("/api/v1/equipment", "equipment"),
    ("/api/v1/tool-tracking", "equipment"),
    ("/api/inventory", "inventory"),
    ("/api/v1/inventory", "inventory"),
    ("/api/v1/maintenance", "maintenance"),
    ("/api/v1/notifications", "notifications"),
    ("/api/v1/analytics", "analytics"),
    ("/api/v1/jobs", "jobs"),
)


def required_feature_for_path(path: str) -> str | None:
    """
    Return the module key required to access this path, or None if not module-scoped.

    Core routes (auth, admin, core ingest, ws, docs) are not gated here.
    """
    normalized = path if path == "/" else path.rstrip("/")
    for prefix, key in _MODULE_PATH_PREFIXES:
        if normalized == prefix or normalized.startswith(prefix + "/"):
            return key
    return None
