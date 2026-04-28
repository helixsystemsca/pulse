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
    all_steps_completed: bool = False,
    photo_attached: bool = False,
    never_flagged: bool = True,
) -> tuple[int, dict[str, int]]:
    """
    Total worker XP for completing a task plus a bucket breakdown for UI.

    Quality factors stack additively up to +35%, then apply as one multiplier on the
    role-scaled base (capped at 2.0× combined with any future extensions). Speed bonus is added after.
    """
    empty: dict[str, int] = {"base": 0, "steps": 0, "photo": 0, "clean": 0, "speed": 0}
    if role_multiplier <= 0:
        return 0, empty

    base_before_quality = int(compute_task_completion_base_xp(task, completed_on_time) * role_multiplier)

    quality = 1.0
    if all_steps_completed:
        quality += 0.15
    if photo_attached:
        quality += 0.10
    if never_flagged:
        quality += 0.10
    quality = min(2.0, quality)

    after_quality = int(base_before_quality * quality)
    speed_bonus = compute_speed_bonus(base_before_quality, completed_on_time, completion_time_hours)
    total = min(500, after_quality + speed_bonus)

    breakdown: dict[str, int] = {
        "base": base_before_quality,
        "steps": int(base_before_quality * 0.15) if all_steps_completed else 0,
        "photo": int(base_before_quality * 0.10) if photo_attached else 0,
        "clean": int(base_before_quality * 0.10) if never_flagged else 0,
        "speed": speed_bonus,
    }
    # Buckets are illustrative; ``total`` is authoritative (rounding vs int(base * quality)).
    return total, breakdown
