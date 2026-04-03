"""Canonical feature keys editable from the internal system admin dashboard."""

# Product-facing catalog (system admin UI). Enabled keys are stored in `company_features`.
GLOBAL_SYSTEM_FEATURES: tuple[str, ...] = (
    "rtls_tracking",
    "work_orders",
    "preventative_maintenance",
    "analytics",
    "alerts",
    "projects",
    "compliance",
    "equipment",
    "inventory",
    "schedule",
)


def normalize_enabled_features(requested: list[str]) -> list[str]:
    allowed = set(GLOBAL_SYSTEM_FEATURES)
    return sorted({f for f in requested if f in allowed})
