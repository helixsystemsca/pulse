"""Daily streak tracking (UTC calendar date)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.xp_rules import STREAK_BONUS_XP
from app.models.gamification_models import UserStats


async def touch_daily_streak(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    activity_day: date,
) -> tuple[int, list[int]]:
    """
    Idempotent per calendar day: extend streak on first qualifying action of ``activity_day``.

    Returns ``(current_streak, milestone_lengths_just_crossed)`` for bonus XP elsewhere.
    """
    stats = await db.get(UserStats, user_id)
    if not stats or str(stats.company_id) != str(company_id):
        stats = UserStats(user_id=str(user_id), company_id=str(company_id))
        db.add(stats)
        await db.flush()

    last = stats.last_streak_activity_date
    if last == activity_day:
        return int(stats.streak or 0), []

    milestones_hit: list[int] = []
    prev = int(stats.streak or 0)

    if last is None:
        stats.streak = 1
    elif last == activity_day - timedelta(days=1):
        stats.streak = prev + 1
    else:
        stats.streak = 1

    stats.last_streak_activity_date = activity_day
    new_streak = int(stats.streak or 0)

    for m in (3, 7, 30, 100):
        if new_streak == m and prev < m:
            milestones_hit.append(m)

    return new_streak, milestones_hit


async def touch_streak_and_award_milestones(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    activity_day: date,
    emit_events: bool = True,
) -> None:
    """
    Extend streak for ``activity_day`` and grant configured milestone bonus XP (idempotent per day/milestone).
    """
    _, milestones = await touch_daily_streak(
        db, company_id=str(company_id), user_id=str(user_id), activity_day=activity_day
    )
    for m in milestones:
        bonus = int(STREAK_BONUS_XP.get(m, 0) or 0)
        if bonus <= 0:
            continue
        from app.services.xp_grant import try_grant_xp

        await try_grant_xp(
            db,
            company_id=str(company_id),
            user_id=str(user_id),
            track="worker",
            amount=bonus,
            reason_code="streak_milestone",
            dedupe_key=f"streak_bonus:{user_id}:{m}:{activity_day.isoformat()}",
            meta={"streak": m},
            reason=f"Streak bonus — {m} days",
            counts_toward_streak=False,
            apply_badges=False,
            apply_streak=False,
            emit_events=emit_events,
        )
