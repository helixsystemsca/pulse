"""Asset lifecycle: depreciation snapshot and retirement."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from app.models.domain import InventoryItem


def straight_line_book_value(item: InventoryItem, *, as_of: Optional[date] = None) -> Optional[float]:
    cost = float(item.acquisition_cost or 0)
    if cost <= 0 or not item.acquired_on:
        return None
    method = (item.depreciation_method or "none").strip().lower()
    if method in ("", "none"):
        return cost
    life_months = int(item.useful_life_months or 0)
    if life_months <= 0:
        return cost
    salvage = float(item.salvage_value or 0)
    depreciable = max(0.0, cost - salvage)
    today = as_of or date.today()
    months = max(
        0,
        (today.year - item.acquired_on.year) * 12 + (today.month - item.acquired_on.month),
    )
    monthly = depreciable / life_months
    accumulated = min(depreciable, monthly * months)
    return max(salvage, cost - accumulated)


def lifecycle_snapshot(item: InventoryItem) -> dict[str, Any]:
    return {
        "acquired_on": item.acquired_on.isoformat() if item.acquired_on else None,
        "acquisition_cost": item.acquisition_cost,
        "useful_life_months": item.useful_life_months,
        "salvage_value": item.salvage_value,
        "expected_retirement_on": item.expected_retirement_on.isoformat()
        if item.expected_retirement_on
        else None,
        "disposed_on": item.disposed_on.isoformat() if item.disposed_on else None,
        "disposal_method": item.disposal_method,
        "disposal_notes": item.disposal_notes,
        "depreciation_method": item.depreciation_method or "none",
        "book_value": straight_line_book_value(item),
    }


def apply_disposal(
    item: InventoryItem,
    *,
    disposed_on: date,
    disposal_method: str,
    disposal_notes: Optional[str] = None,
) -> None:
    item.disposed_on = disposed_on
    item.disposal_method = disposal_method.strip()[:64]
    item.disposal_notes = (disposal_notes or "").strip() or None
    item.inv_status = "retired"
    item.quantity = 0
    item.last_movement_at = datetime.now(timezone.utc)
