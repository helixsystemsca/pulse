"""Idempotent XP grants, level curve, streaks, badges, and realtime fan-out."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import User
from app.models.gamification_models import UserStats, XpLedger
from app.services.avatar_borders import merge_unlocked_borders
from app.services.badge_engine import evaluate_new_badges
from app.services.streak_service import touch_streak_and_award_milestones
from app.services.xp_level_curve import level_from_total_xp, xp_progress, xp_to_next_level
from app.services.xp_reasons import display_reason
from app.services.xp_role_policy import is_xp_excluded_admin, user_may_earn_track

_logger = logging.getLogger(__name__)

XpTrack = Literal["worker", "lead", "supervisor"]


@dataclass
class XpGrantResult:
    applied: int
    total_xp: int
    level: int
    old_level: int
    xp_into_level: int
    xp_to_next_level: int
    new_badges: list[dict[str, Any]] = field(default_factory=list)
    leveled_up: bool = False
    reason_label: str = ""


async def _snapshot(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    applied: int = 0,
    reason_label: str = "",
) -> XpGrantResult:
    stats = await db.get(UserStats, user_id)
    total = int(stats.total_xp) if stats and str(stats.company_id) == str(company_id) else 0
    lvl, into, _seg = xp_progress(total)
    return XpGrantResult(
        applied=applied,
        total_xp=total,
        level=lvl,
        old_level=lvl,
        xp_into_level=into,
        xp_to_next_level=xp_to_next_level(total),
        new_badges=[],
        leveled_up=False,
        reason_label=reason_label,
    )


def _sync_level_and_borders(stats: UserStats) -> int:
    total = int(stats.total_xp or 0)
    lvl = level_from_total_xp(total)
    stats.level = lvl
    stats.unlocked_avatar_borders = merge_unlocked_borders(list(stats.unlocked_avatar_borders or []), lvl)
    return lvl


async def try_grant_xp(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    track: XpTrack,
    amount: int,
    reason_code: str,
    dedupe_key: str,
    meta: dict[str, Any] | None = None,
    reason: str | None = None,
    counts_toward_streak: bool = True,
    apply_badges: bool = True,
    apply_streak: bool = True,
    emit_events: bool = True,
) -> XpGrantResult:
    if amount == 0:
        return await _snapshot(db, company_id=company_id, user_id=user_id)

    dk = (dedupe_key or "").strip()[:500]
    if not dk:
        return await _snapshot(db, company_id=company_id, user_id=user_id)

    user = await db.get(User, user_id)
    if not user or str(user.company_id) != str(company_id):
        return await _snapshot(db, company_id=company_id, user_id=user_id)
    if is_xp_excluded_admin(user):
        return await _snapshot(db, company_id=company_id, user_id=user_id)
    if not user_may_earn_track(user, track):
        return await _snapshot(db, company_id=company_id, user_id=user_id)

    md = dict(meta or {})
    label = (reason or "").strip() or display_reason(reason_code, md)

    delta = int(amount)
    row = {
        "id": str(uuid4()),
        "company_id": str(company_id),
        "user_id": str(user_id),
        "track": track,
        "reason_code": reason_code[:64],
        "reason": label[:2000],
        "dedupe_key": dk,
        "xp_delta": delta,
        "meta": md,
        "created_at": datetime.now(timezone.utc),
    }
    ins = pg_insert(XpLedger).values(**row).on_conflict_do_nothing(constraint="uq_xp_ledger_user_dedupe")
    res = await db.execute(ins)
    if res.rowcount == 0:
        return await _snapshot(db, company_id=company_id, user_id=user_id, reason_label=label)

    stats = await db.get(UserStats, user_id)
    if not stats or str(stats.company_id) != str(company_id):
        stats = UserStats(user_id=str(user_id), company_id=str(company_id))
        db.add(stats)
        await db.flush()

    prev_total = int(stats.total_xp or 0)
    old_level = level_from_total_xp(prev_total)

    stats.total_xp = max(0, prev_total + delta)
    if track == "worker":
        stats.xp_worker = max(0, int(getattr(stats, "xp_worker", 0) or 0) + delta)
    elif track == "lead":
        stats.xp_lead = max(0, int(getattr(stats, "xp_lead", 0) or 0) + delta)
    elif track == "supervisor":
        stats.xp_supervisor = max(0, int(getattr(stats, "xp_supervisor", 0) or 0) + delta)

    today = datetime.now(timezone.utc).date()
    if delta > 0 and apply_streak and counts_toward_streak:
        await touch_streak_and_award_milestones(
            db,
            company_id=str(company_id),
            user_id=str(user_id),
            activity_day=today,
            emit_events=emit_events,
        )

    await db.refresh(stats)
    _sync_level_and_borders(stats)

    new_badges: list[dict[str, Any]] = []
    if delta > 0 and apply_badges:
        new_badges = await evaluate_new_badges(db, company_id=str(company_id), user_id=str(user_id))

    total = int(stats.total_xp or 0)
    lvl, into, _seg = xp_progress(total)
    leveled_up = int(stats.level) > old_level if delta > 0 else False

    cid = str(company_id)
    if emit_events:
        await event_engine.publish(
            DomainEvent(
                event_type="gamification.xp_awarded",
                company_id=cid,
                entity_id=str(user_id),
                source_module="gamification",
                metadata={
                    "user_id": str(user_id),
                    "amount": delta,
                    "reason_code": reason_code,
                    "reason": label,
                    "total_xp": total,
                    "level": lvl,
                    "xp_into_level": into,
                    "xp_to_next_level": xp_to_next_level(total),
                    "leveled_up": leveled_up,
                    "old_level": old_level,
                    "new_badges": new_badges,
                },
            )
        )
        if leveled_up:
            await event_engine.publish(
                DomainEvent(
                    event_type="gamification.level_up",
                    company_id=cid,
                    entity_id=str(user_id),
                    source_module="gamification",
                    metadata={
                        "user_id": str(user_id),
                        "old_level": old_level,
                        "new_level": int(stats.level),
                        "unlocked_borders": list(stats.unlocked_avatar_borders or []),
                    },
                )
            )
        for b in new_badges:
            await event_engine.publish(
                DomainEvent(
                    event_type="gamification.badge_unlocked",
                    company_id=cid,
                    entity_id=str(user_id),
                    source_module="gamification",
                    metadata={"user_id": str(user_id), "badge": b},
                )
            )

    return XpGrantResult(
        applied=delta,
        total_xp=total,
        level=lvl,
        old_level=old_level,
        xp_into_level=into,
        xp_to_next_level=xp_to_next_level(total),
        new_badges=new_badges,
        leveled_up=leveled_up,
        reason_label=label,
    )


async def has_ledger_entry(db: AsyncSession, *, user_id: str, dedupe_key: str) -> bool:
    dk = (dedupe_key or "").strip()[:500]
    q = await db.execute(select(XpLedger.id).where(XpLedger.user_id == user_id, XpLedger.dedupe_key == dk).limit(1))
    return q.scalar_one_or_none() is not None


async def quality_bonus_xp_for_task(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    task_id: str,
) -> int:
    """
    Sum ``steps`` + ``photo`` + ``clean`` from the stored ``xp_breakdown`` on the task_completion ledger row.
    Returns ``0`` if no breakdown (e.g. completions before quality buckets existed).
    """
    rq = await db.execute(
        select(XpLedger.meta).where(
            XpLedger.company_id == company_id,
            XpLedger.user_id == user_id,
            XpLedger.reason_code == "task_completed",
            XpLedger.dedupe_key == f"task_completion:{task_id}",
        ).limit(1)
    )
    meta = rq.scalar_one_or_none()
    if not isinstance(meta, dict):
        return 0
    bd = meta.get("xp_breakdown")
    if not isinstance(bd, dict):
        return 0
    return (
        int(bd.get("steps") or 0)
        + int(bd.get("photo") or 0)
        + int(bd.get("clean") or 0)
    )
