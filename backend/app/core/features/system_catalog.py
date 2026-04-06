"""Canonical feature keys editable from the internal system admin dashboard."""

# Product-facing catalog (system admin UI). Order matches tenant sidebar in `pulse-app.ts`.
# Keys must stay in sync with `helixsystems-landing/lib/pulse-nav-features.ts`.
GLOBAL_SYSTEM_FEATURES: tuple[str, ...] = (
    "compliance",
    "schedule",
    "monitoring",
    "projects",
    "work_orders",
    "workers",
    "inventory",
    "equipment",
    "floor_plan",
)


def normalize_enabled_features(requested: list[str]) -> list[str]:
    allowed = set(GLOBAL_SYSTEM_FEATURES)
    return sorted({f for f in requested if f in allowed})


def canonicalize_enabled_features_for_admin_ui(raw: list[str]) -> list[str]:
    """
    Map legacy `company_features` rows into the current catalog for system-admin checkboxes.
    RTLS rows are folded into `equipment`; unknown keys are dropped.
    """
    r = set(raw)
    out: set[str] = set()
    for f in GLOBAL_SYSTEM_FEATURES:
        if f == "equipment":
            if "equipment" in r or "rtls_tracking" in r or "tool_tracking" in r:
                out.add("equipment")
        elif f in r:
            out.add(f)
    return sorted(out)
