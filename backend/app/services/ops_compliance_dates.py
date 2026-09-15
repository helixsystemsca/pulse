"""Shared 30/60/90-day expiry classification for certs, insurance, WCB, tickets."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

EXPIRY_WINDOWS = (30, 60, 90)


def as_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        raw = value.strip()[:10]
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None
    return None


def days_until(expiry: Optional[date], *, today: Optional[date] = None) -> Optional[int]:
    if expiry is None:
        return None
    return (expiry - (today or date.today())).days


def classify_expiry(expiry: Optional[date], *, today: Optional[date] = None) -> str:
    """Return missing | expired | expiring_30 | expiring_60 | expiring_90 | ok."""
    if expiry is None:
        return "missing"
    remaining = days_until(expiry, today=today)
    assert remaining is not None
    if remaining < 0:
        return "expired"
    if remaining <= 30:
        return "expiring_30"
    if remaining <= 60:
        return "expiring_60"
    if remaining <= 90:
        return "expiring_90"
    return "ok"


def is_attention(status: str) -> bool:
    return status in {"expired", "expiring_30", "expiring_60", "expiring_90", "missing"}


def utc_today() -> date:
    return datetime.now(timezone.utc).date()
