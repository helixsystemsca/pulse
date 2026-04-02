"""
Exercise proximity automation: dwell → movement, cooldown, and far reset.

Modes:
  1) Legacy (default): payload already has worker_id / equipment_id (no MAC resolve).
  2) Full: set AUTOMATION_DEMO_FULL=1 — registers zone, gateway, BLE tags, tool, then sends MAC-based payloads.

Prereqs:
  - Run from `backend/` with `.env` containing DATABASE_URL
  - `alembic upgrade head` (includes device hub + unknown MAC table)

Env:
  AUTOMATION_DEMO_COMPANY_ID
  AUTOMATION_DEMO_USER_ID   (worker in users for that company)
  AUTOMATION_DEMO_EQUIPMENT_ID  (tool id) — optional if AUTOMATION_DEMO_FULL=1 (created)

Usage:
    python -m scripts.run_automation_proximity_demo
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional
from uuid import uuid4

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv(_ROOT / ".env")


def _entity_key(worker_id: str, equipment_id: str) -> str:
    return f"worker:{worker_id}|equipment:{equipment_id}"


async def _main() -> None:
    company_id = os.environ.get("AUTOMATION_DEMO_COMPANY_ID", "").strip()
    user_id = os.environ.get("AUTOMATION_DEMO_USER_ID", "").strip()
    equipment_id = os.environ.get("AUTOMATION_DEMO_EQUIPMENT_ID", "").strip()
    full = os.environ.get("AUTOMATION_DEMO_FULL", "").strip() in ("1", "true", "yes")

    if not company_id or not user_id:
        print("Set AUTOMATION_DEMO_COMPANY_ID and AUTOMATION_DEMO_USER_ID.")
        raise SystemExit(1)

    from sqlalchemy import delete, select

    from app.core.database import AsyncSessionLocal
    from app.models.automation_engine import AutomationEvent, AutomationNotification, AutomationStateTracking
    from app.models.domain import DomainEventRow
    from app.services.automation.event_enricher import enrich_event
    from app.services.automation.event_processor import process_event
    from app.services.devices.device_service import DeviceService

    t_base = 1_710_000_000.0
    worker_mac = "AA:BB:CC:DD:01:01"
    equip_mac = "AA:BB:CC:DD:02:02"
    gateway_ident = f"esp32-demo-{uuid4().hex[:8]}"

    async with AsyncSessionLocal() as db:
        if full:
            from app.models.device_hub import AutomationBleDevice, AutomationGateway

            await db.execute(
                delete(AutomationBleDevice).where(
                    AutomationBleDevice.company_id == company_id,
                    AutomationBleDevice.mac_address.in_((worker_mac, equip_mac)),
                )
            )
            await db.execute(
                delete(AutomationGateway).where(
                    AutomationGateway.company_id == company_id,
                    AutomationGateway.identifier.like("esp32-demo-%"),
                )
            )
            await db.commit()
            svc = DeviceService(db)
            zone = await svc.create_zone(company_id=company_id, name="Demo zone", description="automation demo")
            gw = await svc.create_gateway(
                company_id=company_id,
                name="Demo GW",
                identifier=gateway_ident,
                zone_id=zone.id,
            )
            if not equipment_id:
                tool = await svc.create_equipment(
                    company_id=company_id,
                    name="Demo forklift",
                    equipment_type="vehicle",
                )
                equipment_id = tool.id
            await svc.create_ble_device(
                company_id=company_id,
                name="Worker tag",
                mac_address=worker_mac,
                ble_type="worker_tag",
                assigned_worker_id=user_id,
            )
            ble_eq = await svc.create_ble_device(
                company_id=company_id,
                name="Equipment tag",
                mac_address=equip_mac,
                ble_type="equipment_tag",
            )
            await svc.link_ble_to_equipment(
                company_id=company_id,
                ble_id=ble_eq.id,
                equipment_id=equipment_id,
            )
            gateway_id = gw.id
            await db.commit()
        else:
            if not equipment_id:
                print("Set AUTOMATION_DEMO_EQUIPMENT_ID or use AUTOMATION_DEMO_FULL=1.")
                raise SystemExit(1)
            gateway_id = None

    legacy_zone_id: Optional[str] = None
    if not full:
        from sqlalchemy import select

        from app.models.domain import Zone

        async with AsyncSessionLocal() as db:
            zq = await db.execute(select(Zone.id).where(Zone.company_id == company_id).limit(1))
            legacy_zone_id = zq.scalar_one_or_none()
            if not legacy_zone_id:
                svc = DeviceService(db)
                z = await svc.create_zone(company_id=company_id, name="Automation demo zone (legacy)")
                legacy_zone_id = z.id
            await db.commit()

    entity_key = _entity_key(user_id, equipment_id)

    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(AutomationStateTracking).where(
                AutomationStateTracking.company_id == company_id,
                AutomationStateTracking.entity_key == entity_key,
            )
        )
        await db.execute(
            delete(AutomationNotification).where(
                AutomationNotification.company_id == company_id,
                AutomationNotification.user_id == user_id,
                AutomationNotification.type == "signout_prompt",
            )
        )
        await db.execute(
            delete(DomainEventRow).where(
                DomainEventRow.company_id == company_id,
                DomainEventRow.event_type == "automation_triggered",
            )
        )
        await db.commit()

    async def run_event(payload: dict) -> None:
        async with AsyncSessionLocal() as db:
            row = AutomationEvent(
                company_id=company_id,
                event_type=str(payload["event_type"]),
                payload=dict(payload),
            )
            db.add(row)
            await db.flush()
            er = await enrich_event(db, row)
            if er.process:
                await process_event(db, row)
            await db.commit()

    base: dict = {
        "event_type": "proximity_update",
        "company_id": company_id,
        "distance": "near",
    }
    if full:
        base["gateway_id"] = gateway_id
        base["worker_tag_mac"] = worker_mac
        base["equipment_tag_mac"] = equip_mac
    else:
        base["worker_id"] = user_id
        base["equipment_id"] = equipment_id
        base["zone_id"] = legacy_zone_id

    # Two consecutive "near" readings required before dwell (min_consecutive_near).
    await run_event({**base, "movement": "stationary", "timestamp": t_base})
    await run_event({**base, "movement": "stationary", "timestamp": t_base + 12.0})
    await run_event({**base, "movement": "moving", "timestamp": t_base + 25.0})

    async with AsyncSessionLocal() as db:
        nq = await db.execute(
            select(AutomationNotification).where(
                AutomationNotification.company_id == company_id,
                AutomationNotification.user_id == user_id,
            )
        )
        notes = list(nq.scalars().all())
        evq = await db.execute(
            select(DomainEventRow).where(
                DomainEventRow.company_id == company_id,
                DomainEventRow.event_type == "automation_triggered",
            )
        )
        devents = list(evq.scalars().all())

    if len(notes) != 1:
        print(f"Expected 1 notification after first sequence, got {len(notes)}")
        raise SystemExit(2)
    if len(devents) != 1:
        print(f"Expected 1 automation_triggered domain event, got {len(devents)}")
        raise SystemExit(3)

    # Cooldown: new dwell + movement inside cooldown → no second notification
    t2 = t_base + 35.0
    await run_event({**base, "movement": "stationary", "timestamp": t2})
    await run_event({**base, "movement": "stationary", "timestamp": t2 + 12.0})
    await run_event({**base, "movement": "moving", "timestamp": t2 + 25.0})
    async with AsyncSessionLocal() as db:
        nq = await db.execute(
            select(AutomationNotification).where(
                AutomationNotification.company_id == company_id,
                AutomationNotification.user_id == user_id,
            )
        )
        notes2 = list(nq.scalars().all())
    if len(notes2) != 1:
        print(f"Cooldown failed: expected 1 notification, got {len(notes2)}")
        raise SystemExit(5)

    # Far reset requires two consecutive "far" readings (debounce transient dropouts)
    t3 = t2 + 28.0
    await run_event({**base, "distance": "far", "movement": "moving", "timestamp": t3})
    await run_event({**base, "distance": "far", "movement": "moving", "timestamp": t3 + 0.5})
    await run_event({**base, "distance": "near", "movement": "stationary", "timestamp": t3 + 1.0})
    await run_event({**base, "distance": "near", "movement": "stationary", "timestamp": t3 + 14.0})
    await run_event({**base, "distance": "near", "movement": "moving", "timestamp": t3 + 28.0})
    async with AsyncSessionLocal() as db:
        nq = await db.execute(
            select(AutomationNotification).where(
                AutomationNotification.company_id == company_id,
                AutomationNotification.user_id == user_id,
            )
        )
        notes3 = list(nq.scalars().all())
    if len(notes3) != 2:
        print(f"Far reset: expected 2 notifications, got {len(notes3)}")
        raise SystemExit(6)

    print("OK:", notes[-1].payload)


if __name__ == "__main__":
    asyncio.run(_main())
