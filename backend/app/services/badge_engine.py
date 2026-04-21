"""Milestone badge evaluation (runs after XP-affecting actions)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification_models import BadgeDefinition, Task, TaskEvent, UserBadge, UserStats, XpLedger


async def _existing_badges(db: AsyncSession, user_id: str) -> set[str]:
    q = await db.execute(select(UserBadge.badge_id).where(UserBadge.user_id == user_id))
    return {str(r[0]) for r in q.all()}


async def _count_work_orders_done(db: AsyncSession, *, company_id: str, user_id: str) -> int:
    q = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(
            Task.company_id == company_id,
            Task.assigned_to == user_id,
            Task.source_type == "work_order",
            Task.status == "done",
        )
    )
    return int(q.scalar_one() or 0)


async def _count_on_time_completions(db: AsyncSession, *, company_id: str, user_id: str) -> int:
    q = await db.execute(
        select(func.count())
        .select_from(TaskEvent)
        .join(Task, Task.id == TaskEvent.task_id)
        .where(
            TaskEvent.company_id == company_id,
            TaskEvent.user_id == user_id,
            TaskEvent.was_late.is_(False),
        )
    )
    return int(q.scalar_one() or 0)


async def _count_procedure_like_done(db: AsyncSession, *, company_id: str, user_id: str) -> int:
    q = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(
            Task.company_id == company_id,
            Task.assigned_to == user_id,
            Task.status == "done",
            Task.source_type.in_(("routine", "project")),
        )
    )
    return int(q.scalar_one() or 0)


async def _count_inspection_xp_events(db: AsyncSession, *, company_id: str, user_id: str) -> int:
    q = await db.execute(
        select(func.count())
        .select_from(XpLedger)
        .where(
            XpLedger.company_id == company_id,
            XpLedger.user_id == user_id,
            XpLedger.reason_code == "inspection_sheet_completed",
        )
    )
    return int(q.scalar_one() or 0)


async def evaluate_new_badges(db: AsyncSession, *, company_id: str, user_id: str) -> list[dict]:
    """Insert any newly earned badges; returns payloads for realtime UI."""
    have = await _existing_badges(db, user_id)
    stats = await db.get(UserStats, user_id)
    streak = int(stats.streak or 0) if stats else 0
    wo = await _count_work_orders_done(db, company_id=company_id, user_id=user_id)
    ot = await _count_on_time_completions(db, company_id=company_id, user_id=user_id)
    proc = await _count_procedure_like_done(db, company_id=company_id, user_id=user_id)
    insp = await _count_inspection_xp_events(db, company_id=company_id, user_id=user_id)

    candidates: list[tuple[str, bool]] = [
        ("streak_3", streak >= 3),
        ("streak_7", streak >= 7),
        ("streak_30", streak >= 30),
        ("wo_10", wo >= 10),
        ("wo_50", wo >= 50),
        ("wo_200", wo >= 200),
        ("ontime_10", ot >= 10),
        ("ontime_50", ot >= 50),
        ("proc_10", proc >= 10),
        ("proc_50", proc >= 50),
        ("insp_10", insp >= 10),
    ]

    now = datetime.now(timezone.utc)
    out: list[dict] = []
    for slug, ok in candidates:
        if not ok or slug in have:
            continue
        db.add(UserBadge(user_id=str(user_id), badge_id=slug, unlocked_at=now))
        await db.flush()
        have.add(slug)
        defn = await db.get(BadgeDefinition, slug)
        if defn:
            out.append(
                {
                    "id": defn.id,
                    "name": defn.name,
                    "description": defn.description,
                    "icon_key": defn.icon_key,
                    "category": defn.category,
                    "unlocked_at": now.isoformat(),
                }
            )
    return out
