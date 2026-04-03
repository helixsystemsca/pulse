"""Merge database `automation_feature_configs` with developer-defined defaults (no user-authored rules)."""

from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationFeatureConfig

FEATURE_PROXIMITY_TRACKING = "proximity_tracking"
FEATURE_SOP_ALERTS = "sop_alerts"

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

DEFAULT_SOP_ALERTS_CONFIG: dict[str, Any] = {
    "enabled": True,
    "escalation_delay_seconds": 120,
}

_DEFAULTS_BY_FEATURE: dict[str, dict[str, Any]] = {
    FEATURE_PROXIMITY_TRACKING: dict(DEFAULT_PROXIMITY_CONFIG),
    FEATURE_SOP_ALERTS: dict(DEFAULT_SOP_ALERTS_CONFIG),
}


def known_automation_features() -> tuple[str, ...]:
    return tuple(_DEFAULTS_BY_FEATURE.keys())


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


async def list_merged_all_configs(db: AsyncSession, company_id: str) -> dict[str, dict[str, Any]]:
    """Merged effective config for every feature we expose to setup UIs."""
    out: dict[str, dict[str, Any]] = {}
    for name in known_automation_features():
        out[name] = await get_config(db, company_id, name)
    return out


async def upsert_patch_feature_config(
    db: AsyncSession,
    company_id: str,
    feature_name: str,
    *,
    enabled: Optional[bool] = None,
    config_patch: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Persist partial updates; returns merged effective config (same shape as `get_config`)."""
    if feature_name not in _DEFAULTS_BY_FEATURE:
        raise LookupError("unknown_feature")

    q = await db.execute(
        select(AutomationFeatureConfig).where(
            AutomationFeatureConfig.company_id == company_id,
            AutomationFeatureConfig.feature_name == feature_name,
        )
    )
    row = q.scalar_one_or_none()
    if row is None:
        row = AutomationFeatureConfig(
            id=str(uuid4()),
            company_id=company_id,
            feature_name=feature_name,
            enabled=True if enabled is None else bool(enabled),
            config=dict(config_patch or {}),
        )
        db.add(row)
    else:
        if enabled is not None:
            row.enabled = bool(enabled)
        if config_patch:
            base_cfg = dict(row.config or {})
            base_cfg.update(config_patch)
            row.config = base_cfg
    await db.flush()
    return await get_config(db, company_id, feature_name)
