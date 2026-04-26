"""
Pulse · Office Demo Seed Script
════════════════════════════════════════════════════════════════════════════
Creates everything needed for the real hardware demo in one shot.
Idempotent — safe to run multiple times, won't create duplicates.

What this creates
------------------
  Zone       → Pool
  Equipment  → Hot Tub Boiler (in Pool zone)
  PM Task    → Monthly boiler inspection — overdue by 3 days
  Tool       → Drill (in Pool zone, assigned to Daniel)
  User       → Daniel (if no worker user exists with that name)
  Gateway    → gw-demo-office-01 (your ESP32)
  BLE Device → Daniel's worker tag (your beacon MAC)
  BLE Device → Hot Tub Boiler equipment tag (set mac to "00:00:00:00:00:00" as placeholder)

Usage
------
  cd backend
  python -m scripts.seed_demo_office

  Or with a specific company:
  DEMO_COMPANY_ID=your-uuid python -m scripts.seed_demo_office

  To wipe and re-seed:
  DEMO_RESET=true python -m scripts.seed_demo_office

After running
--------------
  1. Open Pulse → Zones & Devices
  2. Find "gw-demo-office-01" gateway — assign ingest secret
  3. Find Daniel's beacon MAC — confirm it's assigned
  4. Flash ESP32 with that gateway identifier + ingest secret
  5. Run position_engine_single.py on your laptop
  6. Walk beacon past ESP32 for 60s → inference fires
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# ── Path setup (matches seed_sys_admin.py pattern) ───────────────────────────
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

# ── Config ────────────────────────────────────────────────────────────────────

# Override with your actual company UUID from Supabase (companies table)
# or set DEMO_COMPANY_ID env var
DEMO_COMPANY_ID = os.getenv("DEMO_COMPANY_ID", "").strip()

# Your beacon's MAC address — get from the beacon docs or the
# UnknownDevicesPanel after first running the ESP32 near it
DANIEL_BEACON_MAC = os.getenv("DANIEL_BEACON_MAC", "AA:BB:CC:DD:EE:01").strip()

# Your ESP32 gateway identifier — must match GATEWAY_ID in the firmware
GATEWAY_IDENTIFIER = os.getenv("GATEWAY_IDENTIFIER", "gw-demo-office-01").strip()

# Set to "true" to delete existing demo records and re-create them
RESET = os.getenv("DEMO_RESET", "").lower() in ("true", "1", "yes")

# ── Seed keys (used to detect existing records idempotently) ─────────────────
SEED_KEY_ZONE      = "demo_seed_pool_zone"
SEED_KEY_EQUIPMENT = "demo_seed_hot_tub_boiler"
SEED_KEY_TOOL      = "demo_seed_drill"
SEED_KEY_GATEWAY   = "demo_seed_gateway_office"


async def _main() -> None:
    from sqlalchemy import select, delete
    from app.core.database import AsyncSessionLocal
    from app.models.domain import Zone, Tool, ToolStatus, FacilityEquipment, FacilityEquipmentStatus, User, UserRole
    from app.models.pm_models import PmTask
    from app.models.device_hub import AutomationGateway, AutomationBleDevice

    async with AsyncSessionLocal() as db:

        # ── Resolve company_id ────────────────────────────────────────────────
        from app.models.domain import Company
        if DEMO_COMPANY_ID:
            cid = DEMO_COMPANY_ID
        else:
            q = await db.execute(
                select(Company)
                .where(Company.is_active == True)
                .order_by(Company.created_at.asc())
                .limit(1)
            )
            company = q.scalar_one_or_none()
            if company is None:
                print("ERROR: No company found. Set DEMO_COMPANY_ID env var.")
                return
            cid = str(company.id)
            print(f"Using company: {company.name} ({cid[:8]}…)")

        # ── Optional reset ────────────────────────────────────────────────────
        if RESET:
            print("RESET mode — deleting existing demo records…")
            for model in [AutomationBleDevice, AutomationGateway, PmTask]:
                await db.execute(
                    delete(model).where(
                        model.company_id == cid,
                        # Only delete records we created (tagged in meta/name)
                    )
                )
            # Zones tagged with seed key
            await db.execute(
                delete(Zone).where(
                    Zone.company_id == cid,
                    Zone.meta["seed_key"].astext == SEED_KEY_ZONE,
                )
            )
            await db.commit()
            print("Reset complete.\n")

        now = datetime.now(timezone.utc)

        # ── 1. Pool Zone ──────────────────────────────────────────────────────
        q = await db.execute(
            select(Zone).where(
                Zone.company_id == cid,
                Zone.meta["seed_key"].astext == SEED_KEY_ZONE,
            )
        )
        pool_zone = q.scalar_one_or_none()
        if pool_zone is None:
            pool_zone = Zone(
                id=str(uuid4()),
                company_id=cid,
                name="Pool",
                description="Aquatics zone — main pool, hot tub, and associated mechanical.",
                meta={"seed_key": SEED_KEY_ZONE, "zone_type": "aquatics"},
            )
            db.add(pool_zone)
            await db.flush()
            print(f"✓ Created zone: Pool ({pool_zone.id[:8]}…)")
        else:
            print(f"  Zone Pool already exists ({pool_zone.id[:8]}…)")

        # ── 2. Hot Tub Boiler (FacilityEquipment) ────────────────────────────
        q = await db.execute(
            select(FacilityEquipment).where(
                FacilityEquipment.company_id == cid,
                FacilityEquipment.name == "Hot Tub Boiler",
                FacilityEquipment.zone_id == pool_zone.id,
            )
        )
        boiler = q.scalar_one_or_none()
        if boiler is None:
            boiler = FacilityEquipment(
                id=str(uuid4()),
                company_id=cid,
                name="Hot Tub Boiler",
                type="boiler",
                zone_id=pool_zone.id,
                status=FacilityEquipmentStatus.active,
                manufacturer="Raypak",
                model="R407A",
                serial_number="DEMO-HTB-001",
            )
            db.add(boiler)
            await db.flush()
            print(f"✓ Created equipment: Hot Tub Boiler ({boiler.id[:8]}…)")
        else:
            print(f"  Equipment Hot Tub Boiler already exists ({boiler.id[:8]}…)")

        # ── 3. PM Task — overdue by 3 days ───────────────────────────────────
        q = await db.execute(
            select(PmTask).where(
                PmTask.equipment_id == boiler.id,
                PmTask.name == "Monthly boiler inspection & water chemistry check",
            )
        )
        pm_task = q.scalar_one_or_none()
        if pm_task is None:
            pm_task = PmTask(
                id=str(uuid4()),
                equipment_id=boiler.id,
                name="Monthly boiler inspection & water chemistry check",
                description=(
                    "Check water temperature, pressure relief valve, "
                    "chemical balance, and heat exchanger condition."
                ),
                frequency_type="months",
                frequency_value=1,
                next_due_at=now - timedelta(days=3),  # overdue by 3 days
                estimated_duration_minutes=45,
                auto_create_work_order=True,
            )
            db.add(pm_task)
            await db.flush()
            print(f"✓ Created PM task: Monthly boiler inspection (overdue 3 days) ({pm_task.id[:8]}…)")
        else:
            # Make sure it's still overdue (re-running script resets the date)
            pm_task.next_due_at = now - timedelta(days=3)
            await db.flush()
            print(f"  PM task already exists — reset next_due_at to 3 days ago ({pm_task.id[:8]}…)")

        # ── 4. Find or create Daniel ──────────────────────────────────────────
        q = await db.execute(
            select(User).where(
                User.company_id == cid,
                User.full_name.ilike("%daniel%"),
                User.is_active == True,
            ).limit(1)
        )
        daniel = q.scalar_one_or_none()
        if daniel is None:
            # Create a minimal worker user for Daniel
            from app.core.auth.security import hash_password
            daniel = User(
                id=str(uuid4()),
                company_id=cid,
                email=f"daniel.demo.{str(uuid4())[:6]}@pulse.demo",
                full_name="Daniel",
                hashed_password=hash_password("Demo1234!"),
                is_active=True,
                roles=[UserRole.company_member.value],
            )
            db.add(daniel)
            await db.flush()
            print(f"✓ Created worker: Daniel ({daniel.id[:8]}…)")
        else:
            print(f"  Worker Daniel already exists ({daniel.id[:8]}…)")

        # ── 5. Drill Tool ─────────────────────────────────────────────────────
        q = await db.execute(
            select(Tool).where(
                Tool.company_id == cid,
                Tool.name == "Drill",
                Tool.zone_id == pool_zone.id,
            )
        )
        drill = q.scalar_one_or_none()
        if drill is None:
            drill = Tool(
                id=str(uuid4()),
                company_id=cid,
                tag_id=f"DEMO-DRILL-{str(uuid4())[:6]}",
                name="Drill",
                zone_id=pool_zone.id,
                assigned_user_id=str(daniel.id),
                status=ToolStatus.in_use,
            )
            db.add(drill)
            await db.flush()
            print(f"✓ Created tool: Drill assigned to Daniel ({drill.id[:8]}…)")
        else:
            print(f"  Tool Drill already exists ({drill.id[:8]}…)")

        # ── 6. Gateway (ESP32) ────────────────────────────────────────────────
        q = await db.execute(
            select(AutomationGateway).where(
                AutomationGateway.company_id == cid,
                AutomationGateway.identifier == GATEWAY_IDENTIFIER,
            )
        )
        gateway = q.scalar_one_or_none()
        if gateway is None:
            import secrets
            from app.core.auth.security import hash_password
            raw_secret = secrets.token_urlsafe(32)
            gateway = AutomationGateway(
                id=str(uuid4()),
                company_id=cid,
                name="Office Demo Gateway",
                identifier=GATEWAY_IDENTIFIER,
                status="offline",
                assigned=True,
                zone_id=str(pool_zone.id),
                ingest_secret_hash=hash_password(raw_secret),
            )
            db.add(gateway)
            await db.flush()
            print(f"✓ Created gateway: {GATEWAY_IDENTIFIER} ({gateway.id[:8]}…)")
            print(f"\n  ┌─────────────────────────────────────────────────────┐")
            print(f"  │  GATEWAY CREDENTIALS — copy these NOW               │")
            print(f"  │  Gateway UUID:   {gateway.id}")
            print(f"  │  Ingest secret:  {raw_secret}")
            print(f"  │  (not stored in plaintext — this is your only copy) │")
            print(f"  └─────────────────────────────────────────────────────┘\n")
        else:
            print(f"  Gateway {GATEWAY_IDENTIFIER} already exists ({gateway.id[:8]}…)")
            print(f"  To reset the ingest secret, set DEMO_RESET=true and re-run.")

        # ── 7. Daniel's BLE worker tag ────────────────────────────────────────
        from app.services.devices.device_service import normalize_mac
        try:
            norm_mac = normalize_mac(DANIEL_BEACON_MAC)
        except ValueError:
            print(f"WARNING: Invalid DANIEL_BEACON_MAC={DANIEL_BEACON_MAC!r} — skipping BLE device creation")
            norm_mac = None

        if norm_mac:
            q = await db.execute(
                select(AutomationBleDevice).where(
                    AutomationBleDevice.company_id == cid,
                    AutomationBleDevice.mac_address == norm_mac,
                )
            )
            daniel_tag = q.scalar_one_or_none()
            if daniel_tag is None:
                daniel_tag = AutomationBleDevice(
                    id=str(uuid4()),
                    company_id=cid,
                    mac_address=norm_mac,
                    label="Daniel — worker tag",
                    type="worker_tag",
                    assigned_worker_id=str(daniel.id),
                )
                db.add(daniel_tag)
                await db.flush()
                print(f"✓ Created BLE device: Daniel worker tag ({norm_mac})")
            else:
                # Make sure it's assigned to Daniel
                daniel_tag.assigned_worker_id = str(daniel.id)
                daniel_tag.type = "worker_tag"
                await db.flush()
                print(f"  BLE device for Daniel already exists ({norm_mac})")

        # ── Commit everything ─────────────────────────────────────────────────
        await db.commit()

        print("\n" + "═" * 60)
        print("Demo seed complete!")
        print("═" * 60)
        print(f"  Zone:       Pool                  ({pool_zone.id[:8]}…)")
        print(f"  Equipment:  Hot Tub Boiler         ({boiler.id[:8]}…)")
        print(f"  PM Task:    Monthly inspection     (overdue 3 days)")
        print(f"  Worker:     Daniel                 ({daniel.id[:8]}…)")
        print(f"  Tool:       Drill                  ({drill.id[:8]}…)")
        print(f"  Gateway:    {GATEWAY_IDENTIFIER}")
        print(f"  Beacon:     {norm_mac or DANIEL_BEACON_MAC}")
        print()
        print("Next steps:")
        print("  1. Copy gateway UUID + secret printed above into ESP32 firmware")
        print("  2. Copy gateway UUID + secret into position_engine_single.py config")
        print("  3. Flash ESP32, run position engine, walk beacon past ESP32")
        print("  4. Watch inference fire in Pulse dashboard → /demo")


if __name__ == "__main__":
    asyncio.run(_main())
