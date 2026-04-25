"""
Pulse · Config Migration Script
════════════════════════════════════════════════════════════════════════════════
Moves existing config from the three old tables into pulse_config.
Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
Old tables are NOT deleted — they stay and keep working until you
remove the old code paths that read from them.

Run after deploying migration 0070:
    cd backend
    python -m scripts.migrate_config_to_pulse_config

What gets migrated
------------------
1. pulse_org_module_settings  → pulse_config (company scope, per module key)
2. pulse_work_request_settings → pulse_config (module=workRequests)
3. automation_feature_configs  → pulse_config (module=automation)
4. companies.timezone          → pulse_config (module=global, key=timezone)
5. companies.latitude/longitude → pulse_config (module=global)
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")


async def _main() -> None:
    from sqlalchemy import select, text
    from app.core.database import AsyncSessionLocal
    from app.models.pulse_config import PulseConfig
    from app.models.pulse_models import PulseOrgModuleSettings, PulseWorkRequestSettings
    from app.models.automation_engine import AutomationFeatureConfig
    from app.models.domain import Company
    from app.services.config_service import PLATFORM_DEFAULTS

    async with AsyncSessionLocal() as db:

        companies_q = await db.execute(
            select(Company).where(Company.is_active == True)
        )
        companies = companies_q.scalars().all()
        print(f"Migrating config for {len(companies)} companies…\n")

        total_written = 0

        for company in companies:
            cid = str(company.id)
            written = 0

            # ── 1. PulseOrgModuleSettings → pulse_config ──────────────────────
            q = await db.execute(
                select(PulseOrgModuleSettings).where(
                    PulseOrgModuleSettings.company_id == cid
                )
            )
            oms = q.scalar_one_or_none()
            if oms and oms.settings:
                for module, values in oms.settings.items():
                    if not isinstance(values, dict):
                        continue
                    if module not in PLATFORM_DEFAULTS:
                        continue
                    for key, value in values.items():
                        if key not in PLATFORM_DEFAULTS.get(module, {}):
                            continue
                        await db.execute(
                            text("""
                                INSERT INTO pulse_config
                                    (id, company_id, module, scope_type, scope_id, key, value)
                                VALUES
                                    (:id, :cid, :mod, 'company', NULL, :key, :val::jsonb)
                                ON CONFLICT ON CONSTRAINT uq_pulse_config_company_module_scope_key
                                DO NOTHING
                            """),
                            {
                                "id": str(uuid4()), "cid": cid,
                                "mod": module, "key": key,
                                "val": _to_jsonb(value),
                            },
                        )
                        written += 1

            # ── 2. PulseWorkRequestSettings → pulse_config ────────────────────
            q = await db.execute(
                select(PulseWorkRequestSettings).where(
                    PulseWorkRequestSettings.company_id == cid
                )
            )
            wrs = q.scalar_one_or_none()
            if wrs and wrs.settings:
                wr_defaults = PLATFORM_DEFAULTS.get("workRequests", {})
                for key, value in wrs.settings.items():
                    if key not in wr_defaults:
                        continue
                    await db.execute(
                        text("""
                            INSERT INTO pulse_config
                                (id, company_id, module, scope_type, scope_id, key, value)
                            VALUES
                                (:id, :cid, 'workRequests', 'company', NULL, :key, :val::jsonb)
                            ON CONFLICT ON CONSTRAINT uq_pulse_config_company_module_scope_key
                            DO NOTHING
                        """),
                        {
                            "id": str(uuid4()), "cid": cid,
                            "key": key, "val": _to_jsonb(value),
                        },
                    )
                    written += 1

            # ── 3. AutomationFeatureConfig → pulse_config ─────────────────────
            q = await db.execute(
                select(AutomationFeatureConfig).where(
                    AutomationFeatureConfig.company_id == cid
                )
            )
            afc_rows = q.scalars().all()
            auto_defaults = PLATFORM_DEFAULTS.get("automation", {})
            for afc in afc_rows:
                # Map feature name to automation key
                if afc.feature_name == "proximity_tracking":
                    prefix_map = {
                        "min_duration_seconds":   "min_duration_seconds",
                        "cooldown_seconds":        "cooldown_seconds",
                        "movement_required":       "movement_required",
                        "min_consecutive_near":    "min_consecutive_near",
                        "state_timeout_seconds":   "state_timeout_seconds",
                        "max_session_seconds":     "max_session_seconds",
                        "enabled":                 "proximity_tracking_enabled",
                    }
                elif afc.feature_name == "sop_alerts":
                    prefix_map = {
                        "escalation_delay_seconds": "escalation_delay_seconds",
                        "enabled":                  "sop_alerts_enabled",
                    }
                elif afc.feature_name == "maintenance_inference":
                    prefix_map = {
                        "enabled":               "inference_enabled",
                        "min_duration_seconds":  "min_duration_seconds",
                        "cooldown_minutes":      "cooldown_seconds",  # note: convert
                    }
                else:
                    continue

                cfg = dict(afc.config or {})
                if not afc.enabled:
                    cfg["enabled"] = False

                for old_key, new_key in prefix_map.items():
                    if old_key not in cfg:
                        continue
                    value = cfg[old_key]
                    # Convert cooldown_minutes → cooldown_seconds
                    if old_key == "cooldown_minutes" and new_key == "cooldown_seconds":
                        value = int(value) * 60
                    if new_key not in auto_defaults:
                        continue
                    await db.execute(
                        text("""
                            INSERT INTO pulse_config
                                (id, company_id, module, scope_type, scope_id, key, value)
                            VALUES
                                (:id, :cid, 'automation', 'company', NULL, :key, :val::jsonb)
                            ON CONFLICT ON CONSTRAINT uq_pulse_config_company_module_scope_key
                            DO NOTHING
                        """),
                        {
                            "id": str(uuid4()), "cid": cid,
                            "key": new_key, "val": _to_jsonb(value),
                        },
                    )
                    written += 1

            # ── 4. companies.timezone / lat / lon → pulse_config ──────────────
            global_defaults = PLATFORM_DEFAULTS.get("global", {})
            for attr, key in [
                ("timezone",  "timezone"),
                ("latitude",  "latitude"),
                ("longitude", "longitude"),
            ]:
                value = getattr(company, attr, None)
                if value is None or key not in global_defaults:
                    continue
                await db.execute(
                    text("""
                        INSERT INTO pulse_config
                            (id, company_id, module, scope_type, scope_id, key, value)
                        VALUES
                            (:id, :cid, 'global', 'company', NULL, :key, :val::jsonb)
                        ON CONFLICT ON CONSTRAINT uq_pulse_config_company_module_scope_key
                        DO NOTHING
                    """),
                    {
                        "id": str(uuid4()), "cid": cid,
                        "key": key, "val": _to_jsonb(value),
                    },
                )
                written += 1

            await db.commit()
            total_written += written
            print(f"  {company.name[:40]:<40} {written:>4} keys migrated")

        print(f"\nTotal: {total_written} config rows written to pulse_config.")
        print("Old tables untouched — remove old read paths one module at a time.")


def _to_jsonb(value) -> str:
    """Serialize a Python value to a JSON string for the ::jsonb cast."""
    import json
    return json.dumps(value)


if __name__ == "__main__":
    asyncio.run(_main())
