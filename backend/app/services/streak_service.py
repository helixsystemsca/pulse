"""Daily streak tracking (UTC calendar date)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.xp_rules import STREAK_BONUS_XP
from app.models.gamification_models import UserStats

NAMED_STREAK_KEYS = frozenset({"daily_activity", "pm_on_time", "no_flags", "shift_attendance"})


def update_named_streak(
    streaks: dict[str, object],
    streak_type: str,
    activity_day: date,
    *,
    broke: bool = False,
) -> tuple[dict[str, object], bool]:
    """
    Update one named streak bucket (copied from gamification spec).

    Returns ``(updated_streaks_dict, did_mutate)``. When ``broke`` is True, current resets to 0.
    """
    out = dict(streaks)
    entry_obj = out.get(streak_type)
    entry: dict[str, object]
    if isinstance(entry_obj, dict):
        entry = dict(entry_obj)
    else:
        entry = {"current": 0, "best": 0, "last_date": None}

    last = entry.get("last_date")
    last_d = date.fromisoformat(last) if isinstance(last, str) and last else None

    if broke:
        entry["current"] = 0
        out[streak_type] = entry
        return out, True

    if last_d == activity_day:
        return out, False

    prev_cur = int(entry.get("current") or 0)
    if last_d is None or last_d == activity_day - timedelta(days=1):
        entry["current"] = prev_cur + 1
    else:
        entry["current"] = 1

    entry["best"] = max(int(entry.get("best") or 0), int(entry["current"] or 0))
    entry["last_date"] = activity_day.isoformat()
    out[streak_type] = entry
    return out, True


def _sync_daily_activity_bucket(stats: UserStats, activity_day: date) -> None:
    """Mirror ``stats.streak`` / last activity into ``streaks['daily_activity']``."""
    raw: dict[str, object] = dict(stats.streaks) if stats.streaks else {}
    cur = int(stats.streak or 0)
    entry_obj = raw.get("daily_activity")
    entry: dict[str, object]
    if isinstance(entry_obj, dict):
        entry = dict(entry_obj)
    else:
        entry = {"current": 0, "best": 0, "last_date": None}
    entry["current"] = cur
    entry["best"] = max(int(entry.get("best") or 0), cur)
    entry["last_date"] = activity_day.isoformat()
    raw["daily_activity"] = entry
    stats.streaks = raw


async def apply_named_streak(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    streak_type: str,
    activity_day: date,
) -> None:
    """Increment (or continue) a named streak for ``activity_day`` (idempotent per day)."""
    if streak_type not in NAMED_STREAK_KEYS:
        return
    stats = await db.get(UserStats, str(user_id))
    if not stats or str(stats.company_id) != str(company_id):
        stats = UserStats(user_id=str(user_id), company_id=str(company_id))
        db.add(stats)
        await db.flush()
    raw = dict(stats.streaks) if stats.streaks else {}
    new_raw, _changed = update_named_streak(raw, streak_type, activity_day, broke=False)
    if _changed:
        stats.streaks = new_raw  # type: ignore[assignment]


async def apply_named_streak_break(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    streak_type: str,
) -> None:
    """Reset a named streak (e.g. ``no_flags`` on flag)."""
    if streak_type not in NAMED_STREAK_KEYS:
        return
    stats = await db.get(UserStats, str(user_id))
    if not stats or str(stats.company_id) != str(company_id):
        return
    raw = dict(stats.streaks) if stats.streaks else {}
    today = datetime.now(timezone.utc).date()
    new_raw, _changed = update_named_streak(raw, streak_type, today, broke=True)
    if _changed:
        stats.streaks = new_raw  # type: ignore[assignment]


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
        _sync_daily_activity_bucket(stats, activity_day)
        return int(stats.streak or 0), []

    milestones_hit: list[int] = []
    prev = int(stats.streak or 0)

    if last is None:
        stats.streak = 1
    elif last == activity_day - timedelta(days=1):
        stats.streak = prev + 1
    else:
        # Gap in calendar days: reset to 1. (Pause-without-breaking when the worker had no
        # scheduled shift is left for a future iteration — gamification.md §3.)
        stats.streak = 1

    stats.last_streak_activity_date = activity_day
    new_streak = int(stats.streak or 0)

    for m in (3, 7, 30, 100):
        if new_streak == m and prev < m:
            milestones_hit.append(m)

    _sync_daily_activity_bucket(stats, activity_day)
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
