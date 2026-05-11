"""Centralized operational XP awards with daily caps and diminishing returns."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification_models import PulseXpOperatorConfig, XpLedger
from app.services.operational_xp_reason_map import category_for_reason
from app.services.xp_grant import XpGrantResult, try_grant_xp

_logger = logging.getLogger(__name__)

DEFAULT_DAILY_CAPS: dict[str, int] = {
    "general": 400,
    "attendance": 150,
    "procedure": 220,
    "training": 240,
    "routine": 160,
    "work_order": 260,
    "recognition": 100,
    "initiative": 180,
    "compliance": 240,
    "operational": 360,
}

XpTrack = Literal["worker", "lead", "supervisor"]


async def _get_operator_config_row(db: AsyncSession, company_id: str) -> PulseXpOperatorConfig:
    row = await db.get(PulseXpOperatorConfig, str(company_id))
    if row is None:
        row = PulseXpOperatorConfig(company_id=str(company_id))
        db.add(row)
        await db.flush()
    return row


def _merged_daily_caps(cfg: PulseXpOperatorConfig) -> dict[str, int]:
    raw = cfg.category_daily_xp_caps or {}
    out = dict(DEFAULT_DAILY_CAPS)
    if isinstance(raw, dict):
        for k, v in raw.items():
            try:
                out[str(k).lower()] = max(0, int(v))
            except (TypeError, ValueError):
                continue
    return out


async def _category_xp_today(db: AsyncSession, *, company_id: str, user_id: str, category: str) -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    q = await db.execute(
        select(func.coalesce(func.sum(XpLedger.xp_delta), 0)).where(
            XpLedger.company_id == str(company_id),
            XpLedger.user_id == str(user_id),
            XpLedger.created_at >= start,
            XpLedger.category == category,
        )
    )
    return int(q.scalar_one() or 0)


async def _same_category_events_today(db: AsyncSession, *, company_id: str, user_id: str, category: str) -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    q = await db.execute(
        select(func.count())
        .select_from(XpLedger)
        .where(
            XpLedger.company_id == str(company_id),
            XpLedger.user_id == str(user_id),
            XpLedger.created_at >= start,
            XpLedger.category == category,
            XpLedger.xp_delta > 0,
        )
    )
    return int(q.scalar_one() or 0)


async def award_operational_xp(
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
    category: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    apply_caps: bool = True,
    apply_diminishing: bool = True,
    counts_toward_streak: bool = True,
    apply_badges: bool = True,
    apply_streak: bool = True,
    emit_events: bool = True,
) -> XpGrantResult:
    """
    Preferred entry point for new operational XP hooks.
    Applies tenant daily caps (per category) and soft diminishing returns on high-frequency grants.
    """
    md = dict(meta or {})
    cat = category_for_reason(reason_code, category or md.get("category"))
    cfg = await _get_operator_config_row(db, str(company_id))
    thresholds = cfg.professional_level_thresholds if isinstance(cfg.professional_level_thresholds, list) else None

    amt = int(amount)
    if amt <= 0:
        return await try_grant_xp(
            db,
            company_id=str(company_id),
            user_id=str(user_id),
            track=track,
            amount=amt,
            reason_code=reason_code,
            dedupe_key=dedupe_key,
            meta=md,
            reason=reason,
            category=cat,
            source_type=source_type,
            source_id=source_id,
            company_professional_thresholds=thresholds,
            counts_toward_streak=counts_toward_streak,
            apply_badges=apply_badges,
            apply_streak=apply_streak,
            emit_events=emit_events,
        )

    if apply_caps:
        caps = _merged_daily_caps(cfg)
        cap = int(caps.get(cat, caps["general"]))
        used = await _category_xp_today(db, company_id=str(company_id), user_id=str(user_id), category=cat)
        room = max(0, cap - used)
        if room <= 0:
            _logger.info("operational_xp cap hit user=%s category=%s", user_id, cat)
            md["cap_blocked"] = True
            return await try_grant_xp(
                db,
                company_id=str(company_id),
                user_id=str(user_id),
                track=track,
                amount=0,
                reason_code=reason_code,
                dedupe_key=dedupe_key + ":cap_block",
                meta=md,
                reason=reason or "Daily recognition cap reached",
                category=cat,
                source_type=source_type,
                source_id=source_id,
                company_professional_thresholds=thresholds,
                apply_badges=False,
                apply_streak=False,
                emit_events=False,
            )
        amt = min(amt, room)

    if apply_diminishing:
        n = await _same_category_events_today(db, company_id=str(company_id), user_id=str(user_id), category=cat)
        if n >= 10:
            amt = max(1, int(amt * 0.5))
        if n >= 20:
            amt = max(1, int(amt * 0.75))

    return await try_grant_xp(
        db,
        company_id=str(company_id),
        user_id=str(user_id),
        track=track,
        amount=amt,
        reason_code=reason_code,
        dedupe_key=dedupe_key,
        meta=md,
        reason=reason,
        category=cat,
        source_type=source_type,
        source_id=source_id,
        company_professional_thresholds=thresholds,
        counts_toward_streak=counts_toward_streak,
        apply_badges=apply_badges,
        apply_streak=apply_streak,
        emit_events=emit_events,
    )
