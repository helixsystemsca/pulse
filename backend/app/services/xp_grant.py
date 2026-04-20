"""Idempotent XP grants + user_stats rollups."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.gamification_models import UserStats, XpLedger
from app.services.xp_role_policy import is_xp_excluded_admin, user_may_earn_track

_logger = logging.getLogger(__name__)

XpTrack = Literal["worker", "lead", "supervisor"]


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
) -> int:
    """
    Grant XP once per (user_id, dedupe_key). Returns XP actually applied (0 if duplicate or ineligible).
    """
    if amount <= 0:
        return 0
    dk = (dedupe_key or "").strip()[:500]
    if not dk:
        return 0

    user = await db.get(User, user_id)
    if not user or str(user.company_id) != str(company_id):
        return 0
    if is_xp_excluded_admin(user):
        return 0
    if not user_may_earn_track(user, track):
        return 0

    row = {
        "id": str(uuid4()),
        "company_id": str(company_id),
        "user_id": str(user_id),
        "track": track,
        "reason_code": reason_code[:64],
        "dedupe_key": dk,
        "xp_delta": int(amount),
        "meta": dict(meta or {}),
        "created_at": datetime.now(timezone.utc),
    }
    ins = pg_insert(XpLedger).values(**row).on_conflict_do_nothing(constraint="uq_xp_ledger_user_dedupe")
    res = await db.execute(ins)
    if res.rowcount == 0:
        return 0

    stats = await db.get(UserStats, user_id)
    if not stats or str(stats.company_id) != str(company_id):
        stats = UserStats(user_id=str(user_id), company_id=str(company_id))
        db.add(stats)
        await db.flush()

    prev = int(stats.total_xp or 0)
    stats.total_xp = prev + int(amount)
    if track == "worker":
        stats.xp_worker = int(getattr(stats, "xp_worker", 0) or 0) + int(amount)
    elif track == "lead":
        stats.xp_lead = int(getattr(stats, "xp_lead", 0) or 0) + int(amount)
    elif track == "supervisor":
        stats.xp_supervisor = int(getattr(stats, "xp_supervisor", 0) or 0) + int(amount)
    stats.level = int(max(1, int(stats.total_xp) // 100 + 1))
    return int(amount)


async def has_ledger_entry(db: AsyncSession, *, user_id: str, dedupe_key: str) -> bool:
    dk = (dedupe_key or "").strip()[:500]
    q = await db.execute(select(XpLedger.id).where(XpLedger.user_id == user_id, XpLedger.dedupe_key == dk).limit(1))
    return q.scalar_one_or_none() is not None
