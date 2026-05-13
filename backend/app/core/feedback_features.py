"""Product feedback feature keys (aligned with Pulse nav / modules)."""

from __future__ import annotations

# (value stored on `pulse_user_feedback.feature_key`, human label)
FEEDBACK_FEATURE_OPTIONS: tuple[tuple[str, str], ...] = (
    ("overview", "Overview / Dashboard"),
    ("schedule", "Schedule"),
    ("monitoring", "Monitoring"),
    ("projects", "Projects"),
    ("work_requests", "Work Requests"),
    ("standards", "Standards (training & procedures)"),
    ("inventory", "Inventory"),
    ("equipment", "Equipment"),
    ("drawings", "Drawings"),
    ("devices", "Zones & Devices"),
    ("live_map", "Live Map"),
    ("compliance", "Inspections & Logs"),
    ("team_insights", "Team Insights"),
    ("workers", "Team Management"),
    ("settings", "Settings & organization"),
    ("integrations", "Integrations / automation"),
    ("other", "Other / not listed"),
)

VALID_FEEDBACK_FEATURE_KEYS: frozenset[str] = frozenset(k for k, _ in FEEDBACK_FEATURE_OPTIONS)
