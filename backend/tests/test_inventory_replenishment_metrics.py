"""Replenishment metrics helpers."""

from datetime import datetime, timezone

from app.services.inventory_replenishment_metrics_service import _hours_between


def test_hours_between() -> None:
    start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    end = datetime(2026, 1, 1, 14, 30, tzinfo=timezone.utc)
    assert _hours_between(start, end) == 2.5
