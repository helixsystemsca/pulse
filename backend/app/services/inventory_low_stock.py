"""Shared low-stock helpers (no queue/enterprise imports)."""

from __future__ import annotations

from app.models.domain import InventoryItem


def is_item_low_stock(item: InventoryItem) -> bool:
    minimum = float(item.low_stock_threshold or 0)
    if minimum <= 0:
        return False
    return float(item.quantity or 0) <= minimum
