"""Merge database `automation_feature_configs` with developer-defined defaults (no user-authored rules)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationFeatureConfig

FEATURE_PROXIMITY_TRACKING = "proximity_tracking"

DEFAULT_PROXIMITY_CONFIG: dict[str, Any] = {
    "enabled": True,
    "min_duration_seconds": 10,
    "cooldown_seconds": 60,
    "movement_required": True,
    "send_signout_prompt": True,
    "min_consecutive_near": 2,
    "state_timeout_seconds": 30,
    "max_session_seconds": 300,
}

_DEFAULTS_BY_FEATURE: dict[str, dict[str, Any]] = {
    FEATURE_PROXIMITY_TRACKING: dict(DEFAULT_PROXIMITY_CONFIG),
}


async def get_config(db: AsyncSession, company_id: str, feature_name: str) -> dict[str, Any]:
    """Return merged config: code defaults → JSONB `config` from DB; row `enabled` gates the feature."""
    base = dict(_DEFAULTS_BY_FEATURE.get(feature_name, {}))
    q = await db.execute(
        select(AutomationFeatureConfig).where(
            AutomationFeatureConfig.company_id == company_id,
            AutomationFeatureConfig.feature_name == feature_name,
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        return base
    merged = {**base, **(row.config or {})}
    row_enabled = bool(row.enabled)
    cfg_enabled = bool(merged.get("enabled", True))
    merged["enabled"] = row_enabled and cfg_enabled
    return merged
