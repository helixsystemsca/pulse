"""Daily Operations Planner constants — categories, delays, scheduler weights."""

from __future__ import annotations

SEED_CATEGORIES: tuple[tuple[str, str, str], ...] = (
    ("operations", "Operations", "#0ea5e9"),
    ("maintenance", "Maintenance", "#f59e0b"),
    ("asset_management", "Asset Management", "#8b5cf6"),
    ("sops", "SOPs / Procedures", "#10b981"),
    ("compliance", "Compliance / Safety", "#ef4444"),
    ("projects", "Projects", "#6366f1"),
    ("capital_planning", "Capital Planning", "#14b8a6"),
    ("budget", "Budget / Finance", "#84cc16"),
    ("people", "People / Team", "#ec4899"),
    ("meetings", "Meetings", "#64748b"),
    ("walkdowns", "Walkdowns / Inspections", "#f97316"),
    ("administration", "Administration", "#94a3b8"),
    ("communications", "Communications", "#06b6d4"),
    ("strategic", "Strategic Improvement", "#a855f7"),
    ("professional_development", "Professional Development", "#22c55e"),
)

DEFAULT_CATEGORY_TARGETS: dict[str, float] = {
    "operations": 0.20,
    "maintenance": 0.15,
    "asset_management": 0.15,
    "projects": 0.15,
    "people": 0.10,
    "compliance": 0.10,
    "administration": 0.10,
    "strategic": 0.05,
}

DEFAULT_ROUTINE: tuple[tuple[str, str, str, str, bool, bool, int], ...] = ()

DEFAULT_WORK_START = "08:30"
DEFAULT_WORK_END = "16:30"
SNAP_MINUTES = 15
HOUR_SLOT_MINUTES = 60

PRIORITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}

DEFAULT_WEIGHTS: dict[str, int] = {
    "critical": 1000,
    "high": 400,
    "medium": 150,
    "low": 40,
    "due_today": 300,
    "overdue": 500,
    "overdue_per_day": 50,
    "aging_per_day": 8,
    "aging_cap": 200,
    "delay_count": 40,
    "category_match": 250,
    "under_target": 90,
    "fits": 40,
}

DELAY_REASONS: tuple[str, ...] = (
    "meeting",
    "emergency",
    "higher_priority",
    "operational_issue",
    "waiting_on_person",
    "waiting_on_contractor",
    "waiting_on_information",
    "waiting_on_approval",
    "technical_issue",
    "insufficient_time",
    "personal_manual",
    "other",
)

HEALTHY_DELAY_REASONS = frozenset({"emergency", "higher_priority", "operational_issue"})

TASK_STATUSES = (
    "not_started",
    "in_progress",
    "complete",
    "deferred",
    "blocked",
    "cancelled",
)

BLOCK_TYPES = ("routine", "meeting", "task", "open", "interruption")
