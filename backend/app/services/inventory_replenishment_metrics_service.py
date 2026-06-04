"""Replenishment queue timing metrics and closed-cycle archive."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryReplenishmentCycle, InventoryItem, MaterialRequestQueue
from app.services.material_request_queue_service import QUEUE_VISIBLE_STATUSES


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hours_between(start: datetime, end: datetime) -> float:
    delta = end - start
    return max(0.0, delta.total_seconds() / 3600.0)


async def archive_cycle_from_queue_row(
    db: AsyncSession,
    row: MaterialRequestQueue,
    *,
    cleared_at: datetime | None = None,
    replenished_at: datetime | None = None,
) -> InventoryReplenishmentCycle:
    """Persist a closed queue episode for analytics."""
    now = _utcnow()
    end_queue = cleared_at or replenished_at or now
    time_in_queue = _hours_between(row.created_at, end_queue)
    time_to_replenish = (
        _hours_between(row.created_at, replenished_at) if replenished_at is not None else None
    )
    cycle = InventoryReplenishmentCycle(
        id=str(uuid4()),
        company_id=row.company_id,
        inventory_item_id=row.inventory_item_id,
        item_name=row.item_name,
        sku=row.sku,
        low_stock_at=row.created_at,
        exported_at=row.exported_at,
        cleared_at=cleared_at,
        replenished_at=replenished_at,
        time_in_queue_hours=round(time_in_queue, 2),
        time_to_replenish_hours=round(time_to_replenish, 2) if time_to_replenish is not None else None,
        export_batch_id=row.export_batch_id,
        created_at=now,
    )
    db.add(cycle)
    return cycle


async def archive_visible_queue_rows_for_item(
    db: AsyncSession,
    item: InventoryItem,
    *,
    replenished_at: datetime | None = None,
) -> int:
    """Close any open replenishment queue rows when stock recovers."""
    when = replenished_at or _utcnow()
    q = await db.execute(
        select(MaterialRequestQueue).where(
            MaterialRequestQueue.company_id == item.company_id,
            MaterialRequestQueue.inventory_item_id == item.id,
            MaterialRequestQueue.status.in_(QUEUE_VISIBLE_STATUSES),
        )
    )
    rows = list(q.scalars().all())
    for row in rows:
        await archive_cycle_from_queue_row(db, row, replenished_at=when)
        await db.delete(row)
    return len(rows)


@dataclass
class ReplenishmentYoyMetrics:
    current_year: int
    prior_year: int
    avg_time_to_replenish_hours_current: float | None
    avg_time_to_replenish_hours_prior: float | None
    completed_cycles_current_year: int
    completed_cycles_prior_year: int
    change_pct: float | None


@dataclass
class ReplenishmentAnalyticsMetrics:
    active_queue_count: int
    current_avg_time_in_queue_hours: float | None
    current_max_time_in_queue_hours: float | None
    avg_time_in_queue_hours: float | None
    avg_time_to_replenish_hours: float | None
    completed_cycles_count: int
    yoy: ReplenishmentYoyMetrics


async def compute_replenishment_analytics(
    db: AsyncSession, company_id: str
) -> ReplenishmentAnalyticsMetrics:
    now = _utcnow()
    active_q = await db.execute(
        select(MaterialRequestQueue).where(
            MaterialRequestQueue.company_id == company_id,
            MaterialRequestQueue.status.in_(QUEUE_VISIBLE_STATUSES),
        )
    )
    active = list(active_q.scalars().all())
    active_hours = [_hours_between(r.created_at, now) for r in active]
    current_avg = round(sum(active_hours) / len(active_hours), 2) if active_hours else None
    current_max = round(max(active_hours), 2) if active_hours else None

    base = InventoryReplenishmentCycle.company_id == company_id

    avg_queue_q = await db.execute(
        select(func.avg(InventoryReplenishmentCycle.time_in_queue_hours)).where(
            base,
            InventoryReplenishmentCycle.time_in_queue_hours.is_not(None),
        )
    )
    avg_replenish_q = await db.execute(
        select(func.avg(InventoryReplenishmentCycle.time_to_replenish_hours)).where(
            base,
            InventoryReplenishmentCycle.time_to_replenish_hours.is_not(None),
        )
    )
    count_q = await db.execute(select(func.count()).select_from(InventoryReplenishmentCycle).where(base))

    avg_queue = avg_queue_q.scalar_one_or_none()
    avg_replenish = avg_replenish_q.scalar_one_or_none()
    completed = int(count_q.scalar_one() or 0)

    current_year = now.year
    prior_year = current_year - 1

    async def _year_avg(year: int) -> tuple[float | None, int]:
        yq = await db.execute(
            select(
                func.avg(InventoryReplenishmentCycle.time_to_replenish_hours),
                func.count(),
            ).where(
                base,
                InventoryReplenishmentCycle.time_to_replenish_hours.is_not(None),
                extract("year", InventoryReplenishmentCycle.replenished_at) == year,
            )
        )
        row = yq.one()
        avg_v = row[0]
        cnt = int(row[1] or 0)
        return (round(float(avg_v), 2) if avg_v is not None else None, cnt)

    avg_cur, cnt_cur = await _year_avg(current_year)
    avg_prior, cnt_prior = await _year_avg(prior_year)
    change_pct: float | None = None
    if avg_cur is not None and avg_prior is not None and avg_prior > 0:
        change_pct = round(((avg_cur - avg_prior) / avg_prior) * 100.0, 1)

    yoy = ReplenishmentYoyMetrics(
        current_year=current_year,
        prior_year=prior_year,
        avg_time_to_replenish_hours_current=avg_cur,
        avg_time_to_replenish_hours_prior=avg_prior,
        completed_cycles_current_year=cnt_cur,
        completed_cycles_prior_year=cnt_prior,
        change_pct=change_pct,
    )

    return ReplenishmentAnalyticsMetrics(
        active_queue_count=len(active),
        current_avg_time_in_queue_hours=current_avg,
        current_max_time_in_queue_hours=current_max,
        avg_time_in_queue_hours=round(float(avg_queue), 2) if avg_queue is not None else None,
        avg_time_to_replenish_hours=round(float(avg_replenish), 2) if avg_replenish is not None else None,
        completed_cycles_count=completed,
        yoy=yoy,
    )
