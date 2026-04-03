"""Sensor data freshness from last `observed_at` vs expected reporting interval."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

FreshnessState = Literal["live", "delayed", "stale"]


def sensor_freshness(
    observed_at: datetime | None,
    *,
    expected_interval_seconds: int = 300,
    delayed_factor: float = 2.0,
    stale_factor: float = 6.0,
) -> FreshnessState:
    """Classify how current the last sample is.

    - **live**: age ≤ expected interval
    - **delayed**: age ≤ expected × delayed_factor
    - **stale**: older or no timestamp
    """
    if observed_at is None:
        return "stale"
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    age_sec = (now - observed_at).total_seconds()
    if age_sec < 0:
        return "live"
    if age_sec <= expected_interval_seconds:
        return "live"
    if age_sec <= expected_interval_seconds * delayed_factor:
        return "delayed"
    return "stale"
