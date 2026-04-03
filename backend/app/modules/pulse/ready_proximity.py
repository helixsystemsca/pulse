"""Ready-task detection and proximity ranking (priority + due date)."""

from __future__ import annotations

from datetime import date

from app.models.pulse_models import PulseProjectTask
PRI_RANK: dict[str, int] = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def task_priority_str(task: PulseProjectTask) -> str:
    p = task.priority
    return p.value if hasattr(p, "value") else str(p)


def proximity_sort_key(t: PulseProjectTask) -> tuple[int, date]:
    return (PRI_RANK.get(task_priority_str(t), 9), t.due_date if t.due_date else date.max)
