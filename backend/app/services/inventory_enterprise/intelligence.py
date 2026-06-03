"""Queue prioritization and consumption anomaly detection."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, InventoryReorderPolicy, MaterialRequestQueue
from app.services.inventory_enterprise.forecasting import consumption_rate_per_day, forecast_stockout
from app.services.inventory_low_stock import is_item_low_stock


async def detect_consumption_anomaly(
    db: AsyncSession,
    item: InventoryItem,
    *,
    lookback_days: int = 90,
    recent_days: int = 14,
) -> bool:
    """True when recent burn rate diverges sharply from the longer baseline."""
    baseline = await consumption_rate_per_day(db, item, lookback_days=lookback_days)
    recent = await consumption_rate_per_day(db, item, lookback_days=max(7, recent_days))
    if baseline <= 0 and recent <= 0:
        return False
    if baseline <= 0:
        return recent > 0.5
    ratio = recent / baseline
    return ratio >= 2.5 or ratio <= 0.25


def _urgency_tier(score: float, days_until: float | None) -> str:
    if days_until is not None and days_until <= 3:
        return "critical"
    if score >= 80:
        return "critical"
    if score >= 50 or (days_until is not None and days_until <= 14):
        return "high"
    if score >= 25:
        return "normal"
    return "low"


async def compute_queue_priority(
    db: AsyncSession,
    item: InventoryItem,
    queue_row: MaterialRequestQueue | None = None,
) -> dict[str, float | str | bool | None]:
    policy_q = await db.execute(
        select(InventoryReorderPolicy).where(InventoryReorderPolicy.item_id == item.id)
    )
    policy = policy_q.scalar_one_or_none()

    forecast = await forecast_stockout(db, item, policy)
    days_until = forecast.get("days_until_stockout")
    anomaly = await detect_consumption_anomaly(db, item)
    score = 0.0
    if is_item_low_stock(item):
        score += 40.0
    if days_until is not None:
        score += max(0.0, 60.0 - min(60.0, float(days_until) * 4.0))
    if anomaly:
        score += 15.0
    if item.reorder_flag:
        score += 10.0
    tier = _urgency_tier(score, float(days_until) if days_until is not None else None)
    return {
        "priority_score": round(score, 2),
        "days_until_stockout": days_until,
        "urgency_tier": tier,
        "anomaly_flag": anomaly,
    }


async def apply_queue_intelligence(db: AsyncSession, queue_row: MaterialRequestQueue, item: InventoryItem) -> None:
    intel = await compute_queue_priority(db, item, queue_row)
    queue_row.priority_score = float(intel["priority_score"] or 0)
    d = intel.get("days_until_stockout")
    queue_row.days_until_stockout = float(d) if d is not None else None
    queue_row.urgency_tier = str(intel.get("urgency_tier") or "normal")
    queue_row.anomaly_flag = bool(intel.get("anomaly_flag"))
    queue_row.updated_at = datetime.now(timezone.utc)
