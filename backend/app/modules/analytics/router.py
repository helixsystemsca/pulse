"""Read-mostly analytics over persisted domain events."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_company_admin_scoped
from app.core.database import get_db
from app.models.domain import DomainEventRow, User
from app.modules.analytics import MODULE_KEY

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def summary(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
) -> dict[str, Any]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = await db.execute(
        select(DomainEventRow.event_type, func.count())
        .where(DomainEventRow.company_id == user.company_id, DomainEventRow.created_at >= since)
        .group_by(DomainEventRow.event_type)
    )
    buckets = {r[0]: r[1] for r in q.all()}
    return {"since": since.isoformat(), "event_counts": buckets}


@router.get("/trends")
async def trends(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    event_type: str,
    days: int = 14,
) -> dict[str, Any]:
    """Daily counts for one event type (simple operational trend)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", DomainEventRow.created_at)
    q = await db.execute(
        select(day, func.count())
        .where(
            DomainEventRow.company_id == user.company_id,
            DomainEventRow.event_type == event_type,
            DomainEventRow.created_at >= since,
        )
        .group_by(day)
        .order_by(day)
    )
    series = [{"day": r[0].isoformat() if r[0] else None, "count": r[1]} for r in q.all()]
    return {"event_type": event_type, "series": series}


@router.get("/anomalies")
async def anomalies(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    event_type: str,
    days: int = 30,
) -> dict[str, Any]:
    """
    Placeholder anomaly detector: flags if today's volume exceeds 3x the daily average.
    Swap for robust TS models or streaming detection later.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", DomainEventRow.created_at)
    q = await db.execute(
        select(day, func.count())
        .where(
            DomainEventRow.company_id == user.company_id,
            DomainEventRow.event_type == event_type,
            DomainEventRow.created_at >= since,
        )
        .group_by(day)
    )
    counts = [r[1] for r in q.all()]
    if not counts:
        return {"event_type": event_type, "anomaly": False, "detail": "no data"}
    avg = sum(counts) / len(counts)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    q2 = await db.execute(
        select(func.count()).where(
            DomainEventRow.company_id == user.company_id,
            DomainEventRow.event_type == event_type,
            DomainEventRow.created_at >= today_start,
        )
    )
    today_c = int(q2.scalar() or 0)
    flagged = avg > 0 and today_c > 3 * avg
    return {
        "event_type": event_type,
        "anomaly": flagged,
        "today_count": today_c,
        "baseline_daily_avg": round(avg, 3),
    }
