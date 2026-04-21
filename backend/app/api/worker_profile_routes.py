"""Unified Worker Profile endpoint (tenant-scoped)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.core.user_roles import user_has_any_role, user_participates_in_workforce_operations
from app.models.domain import User, UserRole
from app.models.gamification_models import BadgeDefinition, UserBadge, UserStats, XpLedger
from app.schemas.gamification import BadgeOut, XpLedgerRowOut
from app.schemas.worker_profile import WorkerProfileOut
from app.services.xp_level_curve import xp_progress, xp_to_next_level

router = APIRouter(prefix="/users", tags=["worker-profile"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _primary_role(u: User) -> str:
    return str(u.roles[0] if u.roles else "worker")


@router.get("/{user_id}/profile", response_model=WorkerProfileOut)
async def get_worker_profile(
    user_id: str,
    db: Db,
    principal: User = Depends(require_tenant_user),
) -> WorkerProfileOut:
    cid = str(principal.company_id)
    target = await db.get(User, user_id)
    if not target or str(target.company_id) != cid:
        raise HTTPException(status_code=404, detail="User not found")

    # Access rules:
    # - Self can always view self
    # - Company admins/managers can view anyone
    # - Leads/supervisors can view workforce participants
    if str(target.id) != str(principal.id):
        if user_has_any_role(principal, UserRole.company_admin, UserRole.manager):
            pass
        elif user_has_any_role(principal, UserRole.supervisor, UserRole.lead):
            if not user_participates_in_workforce_operations(target):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile access denied")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile access denied")

    stats = await db.get(UserStats, str(target.id))
    if stats and str(stats.company_id) != cid:
        stats = None

    total = int(stats.total_xp) if stats else 0
    lvl, into, _seg = xp_progress(total)
    borders = [str(x) for x in (getattr(stats, "unlocked_avatar_borders", None) or []) if isinstance(x, str)] if stats else []

    # Badges (earned).
    bdq = await db.execute(select(BadgeDefinition))
    badge_def = {str(b.id): b for b in bdq.scalars().all()}
    ubq = await db.execute(
        select(UserBadge)
        .where(UserBadge.user_id == str(target.id))
        .order_by(UserBadge.unlocked_at.desc())
        .limit(48)
    )
    badges: list[BadgeOut] = []
    for ub in ubq.scalars().all():
        bd = badge_def.get(str(ub.badge_id))
        if not bd:
            continue
        badges.append(
            BadgeOut(
                id=str(bd.id),
                name=str(bd.name),
                description=str(bd.description),
                iconKey=str(bd.icon_key),
                category=str(bd.category),
                unlockedAt=ub.unlocked_at,
            )
        )

    # Recent XP log.
    xq = await db.execute(
        select(XpLedger)
        .where(XpLedger.company_id == cid, XpLedger.user_id == str(target.id))
        .order_by(desc(XpLedger.created_at))
        .limit(10)
    )
    recent_xp = [
        XpLedgerRowOut(
            id=str(r.id),
            amount=int(r.xp_delta),
            reasonCode=str(r.reason_code),
            reason=str(r.reason) if r.reason else None,
            track=str(r.track),
            createdAt=r.created_at,
        )
        for r in xq.scalars().all()
    ]

    return WorkerProfileOut(
        userId=str(target.id),
        fullName=str(target.full_name or "").strip() or str(target.email),
        email=str(target.email),
        role=_primary_role(target),
        roles=list(target.roles or []),
        avatarUrl=str(getattr(target, "avatar_url", "") or "") or None,
        totalXp=total,
        level=int(lvl),
        xpIntoLevel=int(into),
        xpToNextLevel=int(xp_to_next_level(total)),
        streak=int(getattr(stats, "streak", 0) if stats else 0),
        bestStreak=int(getattr(stats, "streak", 0) if stats else 0),
        lastStreakActivityDate=str(getattr(stats, "last_streak_activity_date", "") or "") or None,
        avatarBorder=str(getattr(stats, "avatar_border", "") or "") or None,
        unlockedAvatarBorders=borders,
        badges=badges,
        recentXp=recent_xp,
        generatedAt=datetime.now(timezone.utc),
    )

