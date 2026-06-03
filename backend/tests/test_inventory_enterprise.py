"""Enterprise inventory helpers."""

from __future__ import annotations

from datetime import date

from app.models.domain import InventoryItem
from app.services.inventory_enterprise.forecasting import effective_low_stock_threshold
from app.services.inventory_enterprise.lifecycle import straight_line_book_value
from app.models.domain import InventoryReorderPolicy


def test_effective_threshold_seasonal_multiplier() -> None:
    item = InventoryItem(
        id="1",
        company_id="c",
        scope_id="s",
        sku="X",
        name="Filter",
        low_stock_threshold=10.0,
    )
    policy = InventoryReorderPolicy(
        id="p",
        company_id="c",
        item_id="1",
        base_low_stock_threshold=10.0,
        consumption_lookback_days=90,
        seasonal_multipliers={"summer": 1.5},
        event_boosts=[],
    )
    # June → summer
    thr = effective_low_stock_threshold(item, policy)
    assert thr == 15.0


def test_straight_line_depreciation() -> None:
    item = InventoryItem(
        id="1",
        company_id="c",
        scope_id="s",
        sku="A",
        name="Pump",
        acquisition_cost=12000.0,
        acquired_on=date(2020, 1, 1),
        useful_life_months=120,
        salvage_value=2000.0,
        depreciation_method="straight_line",
    )
    book = straight_line_book_value(item, as_of=date(2025, 1, 1))
    assert book is not None
    assert 2000.0 <= book <= 12000.0
