"""Team Insights: workforce engagement + gamification surfaces (tenant-scoped)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.core.user_roles import user_participates_in_workforce_operations
from app.models.domain import User
from app.models.gamification_models import BadgeDefinition, UserBadge, UserStats, XpLedger
from app.schemas.gamification import BadgeOut, XpLedgerRowOut
from app.schemas.team_insights import (
    TeamInsightsActivityOut,
    TeamInsightsOut,
    TeamInsightsSummaryOut,
    TeamInsightsWorkerOut,
)
from app.services.xp_level_curve import xp_progress, xp_to_next_level
from app.services.xp_role_policy import is_xp_excluded_admin

router = APIRouter(prefix="/team", tags=["team-insights"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]


def _primary_role(u: User) -> str:
    return str(u.roles[0] if u.roles else "worker")


async def _build_team_insights(
    db: Db,
    cid: CompanyId,
    user: User = Depends(require_tenant_user),
) -> TeamInsightsOut:
    # Who appears: active workforce participants, excluding managers/admins from XP tracking.
    uq = await db.execute(
        select(User)
        .where(User.company_id == cid, User.is_active.is_(True))
        .order_by(User.full_name.asc().nulls_last(), User.email.asc())
        .limit(700)
    )
    users = [u for u in uq.scalars().all() if user_participates_in_workforce_operations(u) and not is_xp_excluded_admin(u)]
    ids = [str(u.id) for u in users]

    # Stats (xp/level/streak/border).
    stats_by_uid: dict[str, UserStats] = {}
    if ids:
        sq = await db.execute(select(UserStats).where(UserStats.company_id == cid, UserStats.user_id.in_(ids)))
        stats_by_uid = {str(s.user_id): s for s in sq.scalars().all()}

    # Badge catalog lookup for top badges.
    bdq = await db.execute(select(BadgeDefinition))
    badge_def = {str(b.id): b for b in bdq.scalars().all()}
    ub_by_uid: dict[str, list[UserBadge]] = {}
    if ids:
        ubq = await db.execute(select(UserBadge).where(UserBadge.user_id.in_(ids)).order_by(UserBadge.unlocked_at.desc()))
        for ub in ubq.scalars().all():
            ub_by_uid.setdefault(str(ub.user_id), []).append(ub)

    # Summary stats.
    total_team_xp = int(sum(int(stats_by_uid.get(uid).total_xp or 0) for uid in stats_by_uid.keys()))
    active_streaks = int(sum(1 for s in stats_by_uid.values() if int(getattr(s, "streak", 0) or 0) > 0))

    # Top performer this week: sum xp_ledger last 7 days.
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    top_uid = None
    top_week_xp = 0
    improved_uid = None
    improved_delta = 0
    if ids:
        tq = await db.execute(
            select(XpLedger.user_id, func.coalesce(func.sum(XpLedger.xp_delta), 0).label("sx"))
            .where(XpLedger.company_id == cid, XpLedger.created_at >= week_start, XpLedger.user_id.in_(ids))
            .group_by(XpLedger.user_id)
            .order_by(func.sum(XpLedger.xp_delta).desc())
            .limit(1)
        )
        tr = tq.first()
        if tr:
            top_uid = str(tr[0])
            top_week_xp = int(tr[1] or 0)

        # Most improved: last 7 days vs previous 7 days (delta).
        prev_start = datetime.now(timezone.utc) - timedelta(days=14)
        cur = await db.execute(
            select(XpLedger.user_id, func.coalesce(func.sum(XpLedger.xp_delta), 0).label("sx"))
            .where(XpLedger.company_id == cid, XpLedger.created_at >= week_start, XpLedger.user_id.in_(ids))
            .group_by(XpLedger.user_id)
        )
        prev = await db.execute(
            select(XpLedger.user_id, func.coalesce(func.sum(XpLedger.xp_delta), 0).label("sx"))
            .where(
                XpLedger.company_id == cid,
                XpLedger.created_at >= prev_start,
                XpLedger.created_at < week_start,
                XpLedger.user_id.in_(ids),
            )
            .group_by(XpLedger.user_id)
        )
        cur_map = {str(uid): int(sx or 0) for (uid, sx) in cur.all()}
        prev_map = {str(uid): int(sx or 0) for (uid, sx) in prev.all()}
        best_uid = None
        best_delta = 0
        for uid in ids:
            d = int(cur_map.get(uid, 0) - prev_map.get(uid, 0))
            if d > best_delta:
                best_delta = d
                best_uid = uid
        improved_uid = best_uid
        improved_delta = best_delta

    user_by_id = {str(u.id): u for u in users}
    top_name = (user_by_id.get(top_uid).full_name if top_uid and user_by_id.get(top_uid) else None) if top_uid else None
    imp_name = (
        (user_by_id.get(improved_uid).full_name if improved_uid and user_by_id.get(improved_uid) else None)
        if improved_uid
        else None
    )

    # Recent activity feed: last 50 XP events for the company.
    aq = await db.execute(
        select(XpLedger)
        .where(XpLedger.company_id == cid, XpLedger.user_id.in_(ids))
        .order_by(XpLedger.created_at.desc())
        .limit(60)
    )
    ledger_rows = aq.scalars().all()

    activity: list[TeamInsightsActivityOut] = []
    for row in ledger_rows[:50]:
        u = user_by_id.get(str(row.user_id))
        if not u:
            continue
        label = (row.reason or "").strip() or str(row.reason_code)
        msg = f"+{int(row.xp_delta)} XP — {label}"
        activity.append(
            TeamInsightsActivityOut(
                createdAt=row.created_at,
                userId=str(row.user_id),
                userName=str(u.full_name or u.email),
                kind="xp",
                message=msg,
                xpDelta=int(row.xp_delta),
            )
        )

    # Worker cards.
    out_workers: list[TeamInsightsWorkerOut] = []
    for u in users:
        st = stats_by_uid.get(str(u.id))
        total = int(st.total_xp) if st else 0
        lvl, into, _seg = xp_progress(total)
        badges: list[BadgeOut] = []
        for ub in (ub_by_uid.get(str(u.id)) or [])[:3]:
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
        out_workers.append(
            TeamInsightsWorkerOut(
                userId=str(u.id),
                fullName=str(u.full_name or "").strip() or str(u.email),
                email=str(u.email),
                role=_primary_role(u),
                roles=list(u.roles or []),
                avatarUrl=str(getattr(u, "avatar_url", "") or "") or None,
                totalXp=total,
                level=int(lvl),
                xpIntoLevel=int(into),
                xpToNextLevel=int(xp_to_next_level(total)),
                streak=int(getattr(st, "streak", 0) if st else 0),
                lastStreakActivityDate=str(getattr(st, "last_streak_activity_date", "") or "") or None,
                avatarBorder=str(getattr(st, "avatar_border", "") or "") or None,
                badges=badges,
            )
        )

    summary = TeamInsightsSummaryOut(
        totalTeamXp=total_team_xp,
        activeStreaks=active_streaks,
        topPerformerUserId=top_uid,
        topPerformerName=str(top_name).strip() if top_name else None,
        topPerformerWeekXp=int(top_week_xp),
        mostImprovedUserId=improved_uid,
        mostImprovedName=str(imp_name).strip() if imp_name else None,
        mostImprovedDelta=int(improved_delta),
    )
    return TeamInsightsOut(summary=summary, workers=out_workers, recentActivity=activity)


@router.get("/insights", response_model=TeamInsightsOut)
async def team_insights(
    db: Db,
    cid: CompanyId,
    user: User = Depends(require_tenant_user),
) -> TeamInsightsOut:
    return await _build_team_insights(db, cid, user)


# Backwards/alternate route shape: requested as `GET /team-insights` in product docs.
@router.get("/team-insights", response_model=TeamInsightsOut)
async def team_insights_alias(
    db: Db,
    cid: CompanyId,
    user: User = Depends(require_tenant_user),
) -> TeamInsightsOut:
    return await _build_team_insights(db, cid, user)

