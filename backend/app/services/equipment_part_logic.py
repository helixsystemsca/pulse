"""Pure helpers for equipment part replacement scheduling and status."""

from __future__ import annotations

from datetime import date, timedelta

DUE_SOON_DAYS_DEFAULT = 14


def derive_next_replacement_date(
    last_replaced_date: date | None,
    replacement_interval_days: int | None,
) -> date | None:
    if last_replaced_date is not None and replacement_interval_days is not None and replacement_interval_days > 0:
        return last_replaced_date + timedelta(days=replacement_interval_days)
    return None


def part_maintenance_status(
    next_replacement_date: date | None,
    *,
    today: date,
    due_soon_days: int = DUE_SOON_DAYS_DEFAULT,
) -> str:
    """Return ok | due_soon | overdue (unknown schedule → ok)."""
    if next_replacement_date is None:
        return "ok"
    if next_replacement_date < today:
        return "overdue"
    if next_replacement_date <= today + timedelta(days=due_soon_days):
        return "due_soon"
    return "ok"
