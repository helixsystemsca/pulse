"""Consumption forecasting and effective reorder thresholds."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, InventoryMovement, InventoryReorderPolicy, InventoryUsage


def _season_key(now: datetime) -> str:
    m = now.month
    if m in (12, 1, 2):
        return "winter"
    if m in (3, 4, 5):
        return "spring"
    if m in (6, 7, 8):
        return "summer"
    return "fall"


def effective_low_stock_threshold(item: InventoryItem, policy: InventoryReorderPolicy | None) -> float:
    base = float(item.low_stock_threshold or 0)
    if policy is not None and policy.base_low_stock_threshold is not None:
        base = float(policy.base_low_stock_threshold)
    if base <= 0:
        return 0.0
    mult = 1.0
    if policy is not None:
        seasonal = policy.seasonal_multipliers or {}
        if isinstance(seasonal, dict):
            mult *= float(seasonal.get(_season_key(datetime.now(timezone.utc)), 1.0) or 1.0)
        boosts = policy.event_boosts or []
        if isinstance(boosts, list):
            for row in boosts:
                if not isinstance(row, dict):
                    continue
                try:
                    mult *= float(row.get("multiplier", 1.0) or 1.0)
                except (TypeError, ValueError):
                    continue
    return max(0.0, base * mult)


async def consumption_rate_per_day(
    db: AsyncSession,
    item: InventoryItem,
    *,
    lookback_days: int = 90,
) -> float:
    """Average units consumed per day from usage rows and outbound movements."""
    since = datetime.now(timezone.utc) - timedelta(days=max(7, lookback_days))
    usage_sum = (
        await db.execute(
            select(func.coalesce(func.sum(InventoryUsage.quantity), 0)).where(
                InventoryUsage.item_id == item.id,
                InventoryUsage.created_at >= since,
            )
        )
    ).scalar_one()
    move_sum = (
        await db.execute(
            select(func.coalesce(func.sum(InventoryMovement.quantity), 0)).where(
                InventoryMovement.item_id == item.id,
                InventoryMovement.action.in_(("used", "checkout", "consume")),
                InventoryMovement.created_at >= since,
            )
        )
    ).scalar_one()
    total = float(usage_sum or 0) + float(move_sum or 0)
    days = max(1.0, float(lookback_days))
    return total / days


async def forecast_stockout(
    db: AsyncSession,
    item: InventoryItem,
    policy: InventoryReorderPolicy | None = None,
) -> dict[str, float | str | bool | None]:
    lookback = int(policy.consumption_lookback_days) if policy else 90
    rate = await consumption_rate_per_day(db, item, lookback_days=lookback)
    qty = float(item.quantity or 0)
    threshold = effective_low_stock_threshold(item, policy)
    days_until: Optional[float] = None
    if rate > 0:
        target = max(0.0, qty - threshold)
        days_until = target / rate if target > 0 else 0.0
    return {
        "quantity": qty,
        "effective_threshold": threshold,
        "consumption_per_day": round(rate, 4),
        "days_until_stockout": round(days_until, 2) if days_until is not None else None,
        "lookback_days": lookback,
    }
