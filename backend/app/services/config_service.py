"""
backend/app/services/config_service.py
════════════════════════════════════════════════════════════════════════════════
The single config service all modules should use.

Usage
------
    from app.services.config_service import ConfigService

    # Read one value (with platform default fallback)
    val = await ConfigService.get(db, company_id, module="schedule", key="facilityCount")

    # Read all config for a module (company + zone overrides merged)
    cfg = await ConfigService.get_module(db, company_id, module="schedule")

    # Read with a zone override applied on top
    cfg = await ConfigService.get_module(db, company_id, module="automation", zone_id=zone_id)

    # Write one value
    await ConfigService.set(db, company_id, module="schedule", key="facilityCount",
                            value=3, updated_by=user_id)

    # Write a zone override
    await ConfigService.set(db, company_id, module="automation", key="sla.p1_response_minutes",
                            value=15, zone_id=zone_id, updated_by=user_id)

    # Delete a value (falls back to company setting or platform default)
    await ConfigService.delete(db, company_id, module="schedule", key="facilityCount")

Design rules
------------
1. Modules read from this service ONLY. Never query pulse_config directly in route handlers.
2. This service never reads from pulse_org_module_settings or AutomationFeatureConfig —
   those are the old tables. Modules migrate to this service one at a time.
3. Platform defaults live in PLATFORM_DEFAULTS below. Add a new key here when you add a
   new configurable behaviour — no migration needed.
4. Zone overrides shadow company settings for the same key.
   If no zone override exists, falls back to company setting.
   If no company setting exists, falls back to PLATFORM_DEFAULTS.
5. get() never raises — always returns a value (the default if nothing is stored).
"""

from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_config import PulseConfig

log = logging.getLogger("pulse.config")

# ══════════════════════════════════════════════════════════════════════════════
# PLATFORM DEFAULTS
# The canonical default for every configurable value in the system.
# Keys must match what modules pass to ConfigService.get().
# Grouped by module for readability — the module param is what matters at runtime.
# ══════════════════════════════════════════════════════════════════════════════

PLATFORM_DEFAULTS: dict[str, dict[str, Any]] = {

    # ── global ────────────────────────────────────────────────────────────────
    "global": {
        "timezone":           "UTC",
        "latitude":           None,
        "longitude":          None,
        "facility_name":      None,
        "industry":           None,
        "date_format":        "MMM D, YYYY",
        "time_format":        "12h",
        "currency":           "CAD",
    },

    # ── workRequests ──────────────────────────────────────────────────────────
    "workRequests": {
        "requirePhotoOnClose":      False,
        "autoAssignTechnician":     False,
        "enablePriorityLevels":     True,
        "lockAfterCompletion":      False,
        "allowManualOverride":      True,
        "categories":               [],        # manager-defined list of category strings
        "default_priority":         "medium",  # low | medium | high | critical
        "sla.p1_response_minutes":  60,
        "sla.p2_response_minutes":  240,
        "sla.p3_response_minutes":  1440,
        "sla.enabled":              False,
    },

    # ── schedule ──────────────────────────────────────────────────────────────
    "schedule": {
        "allowShiftOverrides":      True,
        "enforceMaxHours":          0,
        "autoGenerateShifts":       False,
        "coverageRules":            [],
        "enableNightAssignments":   False,     # was True — fixed per audit
        "facilityCount":            1,         # was 3 — fixed per audit
        "facilityLabels":           [],
        "workDayStart":             "07:00",
        "workDayEnd":               "18:00",
    },

    # ── workers ───────────────────────────────────────────────────────────────
    "workers": {
        "operational_roles":        [],        # manager-defined role names
        "skill_tags_enabled":       True,
        "cert_tracking_enabled":    True,
        "certifications": {                    # manager-defined cert codes
            "definitions": [],                 # [{code, label, style}]
            "priority_order": [],
        },
        "gamification_enabled":     True,
    },

    # ── assets ────────────────────────────────────────────────────────────────
    "assets": {
        "requireSerialNumber":      False,
        "enableMaintenanceHistory": True,
        "allowAssetHierarchy":      True,
        "equipment_types":          [],        # manager-defined equipment type tags
    },

    # ── zones ─────────────────────────────────────────────────────────────────
    "zones": {
        "default_sla_p1_minutes":   60,
        "default_sla_p2_minutes":   240,
        "require_zone_on_workorder": False,
        "zone_types":               [],        # manager-defined zone type labels
    },

    # ── automation ────────────────────────────────────────────────────────────
    "automation": {
        "proximity_tracking_enabled":   True,
        "min_duration_seconds":         10,
        "cooldown_seconds":             60,
        "movement_required":            True,
        "min_consecutive_near":         2,
        "state_timeout_seconds":        30,
        "max_session_seconds":          300,
        "escalation_delay_seconds":     120,
        "inference_enabled":            True,
        "inference_notify_threshold":   0.90,
        "inference_flag_threshold":     0.70,
        "sop_alerts_enabled":           True,
    },

    # ── compliance ────────────────────────────────────────────────────────────
    "compliance": {
        "requireManagerForEscalation":  False,
        "showRepeatOffenderHighlight":  True,
        "strictReviewDeadlines":        False,
        "categories":                   [],    # manager-defined category labels
    },

    # ── notifications ─────────────────────────────────────────────────────────
    "notifications": {
        "push_enabled":             True,
        "email_enabled":            True,
        "quiet_hours_enabled":      False,
        "quiet_hours_start":        "22:00",
        "quiet_hours_end":          "07:00",
        "inference_notify_channel": "push",    # push | email | both
        "pm_reminder_days_before":  3,
        "overdue_escalation_enabled": True,
    },

    # ── gamification ──────────────────────────────────────────────────────────
    "gamification": {
        "enabled":                  True,
        "xp_per_task_base":         10,
        "priority_multipliers": {
            "low":      1,
            "medium":   2,
            "high":     3,
            "critical": 5,
        },
        "streak_bonus_pct":         10,
        "leaderboard_visible":      True,
        "leaderboard_period":       "weekly",   # daily | weekly | monthly | all_time
    },

    # ── blueprint ─────────────────────────────────────────────────────────────
    "blueprint": {
        "enableSnapping":           True,
        "showGrid":                 True,
        "enableAutoConnect":        True,
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# CONFIG SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class ConfigService:

    # ── Read ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def get(
        db: AsyncSession,
        company_id: str,
        module: str,
        key: str,
        zone_id: Optional[str] = None,
    ) -> Any:
        """
        Get one config value. Resolution order:
            zone override → company setting → platform default

        Never raises — always returns something.
        """
        module_defaults = PLATFORM_DEFAULTS.get(module, {})
        platform_default = module_defaults.get(key)

        # Try zone override first (if zone_id provided)
        if zone_id:
            q = await db.execute(
                select(PulseConfig).where(
                    PulseConfig.company_id == company_id,
                    PulseConfig.module == module,
                    PulseConfig.scope_type == "zone",
                    PulseConfig.scope_id == zone_id,
                    PulseConfig.key == key,
                )
            )
            row = q.scalar_one_or_none()
            if row is not None:
                return row.value

        # Try company setting
        q = await db.execute(
            select(PulseConfig).where(
                PulseConfig.company_id == company_id,
                PulseConfig.module == module,
                PulseConfig.scope_type == "company",
                PulseConfig.scope_id == None,  # noqa: E711
                PulseConfig.key == key,
            )
        )
        row = q.scalar_one_or_none()
        if row is not None:
            return row.value

        return platform_default

    @staticmethod
    async def get_module(
        db: AsyncSession,
        company_id: str,
        module: str,
        zone_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Get all config for a module as a flat dict.
        Starts from platform defaults, overlays company settings,
        then overlays zone overrides (if zone_id provided).

        This is the primary method modules should use — it gives a complete
        picture of all config for a module in one call.
        """
        # Start with platform defaults
        result = deepcopy(PLATFORM_DEFAULTS.get(module, {}))

        # Collect company settings + zone overrides in one query
        conditions = [
            PulseConfig.company_id == company_id,
            PulseConfig.module == module,
        ]
        if zone_id:
            from sqlalchemy import or_
            conditions.append(
                or_(
                    PulseConfig.scope_type == "company",
                    (PulseConfig.scope_type == "zone") & (PulseConfig.scope_id == zone_id),
                )
            )
        else:
            conditions.append(PulseConfig.scope_type == "company")

        q = await db.execute(
            select(PulseConfig).where(*conditions)
        )
        rows = q.scalars().all()

        # Apply company settings first, then zone overrides on top
        company_rows = [r for r in rows if r.scope_type == "company"]
        zone_rows    = [r for r in rows if r.scope_type == "zone"]

        for row in company_rows:
            result[row.key] = row.value
        for row in zone_rows:
            result[row.key] = row.value

        return result

    @staticmethod
    async def get_zone_overrides(
        db: AsyncSession,
        company_id: str,
        zone_id: str,
    ) -> dict[str, dict[str, Any]]:
        """
        Get all zone overrides for a zone, grouped by module.
        Used by the zone settings UI to show what's been customized.
        """
        q = await db.execute(
            select(PulseConfig).where(
                PulseConfig.company_id == company_id,
                PulseConfig.scope_type == "zone",
                PulseConfig.scope_id == zone_id,
            )
        )
        rows = q.scalars().all()
        result: dict[str, dict[str, Any]] = {}
        for row in rows:
            result.setdefault(row.module, {})[row.key] = row.value
        return result

    # ── Write ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def set(
        db: AsyncSession,
        company_id: str,
        module: str,
        key: str,
        value: Any,
        zone_id: Optional[str] = None,
        updated_by: Optional[str] = None,
        autocommit: bool = False,
    ) -> None:
        """
        Upsert one config value. Creates if not exists, updates if it does.
        Pass zone_id to create a zone override instead of a company setting.
        """
        scope_type = "zone" if zone_id else "company"

        await db.execute(
            pg_insert(PulseConfig).values(
                id=str(uuid4()),
                company_id=company_id,
                module=module,
                scope_type=scope_type,
                scope_id=zone_id,
                key=key,
                value=value,
                updated_by=updated_by,
            ).on_conflict_do_update(
                constraint="uq_pulse_config_company_module_scope_key",
                set_={
                    "value":      pg_insert(PulseConfig).excluded.value,
                    "updated_by": pg_insert(PulseConfig).excluded.updated_by,
                    "updated_at": pg_insert(PulseConfig).excluded.updated_at,
                },
            )
        )

        if autocommit:
            await db.commit()

        log.debug(
            "config.set company=%s module=%s scope=%s/%s key=%s",
            company_id[:8], module, scope_type, (zone_id or "")[:8], key,
        )

    @staticmethod
    async def set_many(
        db: AsyncSession,
        company_id: str,
        module: str,
        values: dict[str, Any],
        zone_id: Optional[str] = None,
        updated_by: Optional[str] = None,
        autocommit: bool = False,
    ) -> None:
        """
        Upsert multiple keys for a module in one operation.
        Used by the Settings UI when saving a whole section at once.
        """
        for key, value in values.items():
            await ConfigService.set(
                db, company_id, module, key, value,
                zone_id=zone_id, updated_by=updated_by, autocommit=False,
            )
        if autocommit:
            await db.commit()

    @staticmethod
    async def delete(
        db: AsyncSession,
        company_id: str,
        module: str,
        key: str,
        zone_id: Optional[str] = None,
        autocommit: bool = False,
    ) -> None:
        """
        Delete a config value. The key falls back to company setting (if
        deleting a zone override) or platform default (if deleting a company setting).
        """
        scope_type = "zone" if zone_id else "company"
        conditions = [
            PulseConfig.company_id == company_id,
            PulseConfig.module == module,
            PulseConfig.scope_type == scope_type,
            PulseConfig.key == key,
        ]
        if zone_id:
            conditions.append(PulseConfig.scope_id == zone_id)
        else:
            conditions.append(PulseConfig.scope_id == None)  # noqa: E711

        await db.execute(delete(PulseConfig).where(*conditions))
        if autocommit:
            await db.commit()

    # ── Convenience helpers ───────────────────────────────────────────────────

    @staticmethod
    async def get_bool(
        db: AsyncSession, company_id: str, module: str, key: str,
        zone_id: Optional[str] = None,
    ) -> bool:
        val = await ConfigService.get(db, company_id, module, key, zone_id)
        return bool(val)

    @staticmethod
    async def get_int(
        db: AsyncSession, company_id: str, module: str, key: str,
        zone_id: Optional[str] = None,
    ) -> int:
        val = await ConfigService.get(db, company_id, module, key, zone_id)
        return int(val) if val is not None else 0

    @staticmethod
    async def get_str(
        db: AsyncSession, company_id: str, module: str, key: str,
        zone_id: Optional[str] = None,
    ) -> Optional[str]:
        val = await ConfigService.get(db, company_id, module, key, zone_id)
        return str(val) if val is not None else None

    @staticmethod
    def get_platform_default(module: str, key: str) -> Any:
        """Synchronous — returns the platform default without a DB call."""
        return PLATFORM_DEFAULTS.get(module, {}).get(key)

    @staticmethod
    def all_platform_defaults() -> dict[str, dict[str, Any]]:
        """Returns a deep copy of all platform defaults."""
        return deepcopy(PLATFORM_DEFAULTS)
