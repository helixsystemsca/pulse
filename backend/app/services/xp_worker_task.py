"""Worker-track XP for completing gamified tasks."""

from __future__ import annotations

from app.models.gamification_models import Task


def compute_task_completion_base_xp(task: Task, completed_on_time: bool) -> int:
    base = {
        "routine": 5,
        "pm": 10,
        "work_order": 15,
        "project": 25,
        "self": 3,
    }.get(str(task.source_type), 5)
    xp = base * int(task.difficulty or 1) * int(task.priority or 1)
    xp = xp * (1.2 if completed_on_time else 0.8)
    return int(xp)


def compute_speed_bonus(base_xp: int, completed_on_time: bool, completion_time_hours: float) -> int:
    """Small bonus for finishing quickly while still on time."""
    if not completed_on_time or completion_time_hours > 4.0:
        return 0
    return min(25, max(1, int(base_xp * 0.12)))


def compute_worker_task_completion_xp(
    task: Task,
    *,
    completed_on_time: bool,
    completion_time_hours: float,
    role_multiplier: float,
) -> int:
    if role_multiplier <= 0:
        return 0
    base = compute_task_completion_base_xp(task, completed_on_time)
    base = int(base * role_multiplier)
    bonus = compute_speed_bonus(base, completed_on_time, completion_time_hours)
    return min(500, base + bonus)
