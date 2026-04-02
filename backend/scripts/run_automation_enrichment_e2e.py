"""
End-to-end automation ingest: register gateway + BLE tags, send RAW MAC-based events.

Flow matches production:
  persist AutomationEvent → enrich_event → process_event

Prereqs:
  - backend/.env with DATABASE_URL
  - alembic upgrade head

Env:
  AUTOMATION_DEMO_COMPANY_ID
  AUTOMATION_DEMO_USER_ID   (must exist in users for that company)

Usage:
  python -m scripts.run_automation_enrichment_e2e
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import delete, select

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv(_ROOT / ".env")


async def main() -> None:
    company_id = os.environ.get("AUTOMATION_DEMO_COMPANY_ID", "").strip()
    user_id = os.environ.get("AUTOMATION_DEMO_USER_ID", "").strip()
    if not company_id or not user_id:
        print("Set AUTOMATION_DEMO_COMPANY_ID and AUTOMATION_DEMO_USER_ID.")
        raise SystemExit(1)

    from app.core.database import AsyncSessionLocal
    from app.models.automation_engine import AutomationEvent, AutomationNotification, AutomationStateTracking
    from app.models.device_hub import AutomationBleDevice, AutomationGateway
    from app.models.domain import DomainEventRow
    from app.services.automation.event_enricher import enrich_event
    from app.services.automation.event_processor import process_event
    from app.services.devices.device_service import DeviceService

    worker_mac = "AA:BB:CC:DD:AA:01"
    equip_mac = "AA:BB:CC:DD:AA:02"
    gw_ident = f"e2e-gw-{uuid4().hex[:8]}"

    t0 = 1_720_000_000.0

    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(AutomationBleDevice).where(
                AutomationBleDevice.company_id == company_id,
                AutomationBleDevice.mac_address.in_((worker_mac, equip_mac)),
            )
        )
        await db.execute(
            delete(AutomationGateway).where(
                AutomationGateway.company_id == company_id,
                AutomationGateway.identifier.like("e2e-gw-%"),
            )
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        svc = DeviceService(db)
        zone = await svc.create_zone(company_id=company_id, name="E2E automation zone")
        gw = await svc.create_gateway(
            company_id=company_id,
            name="E2E gateway",
            identifier=gw_ident,
            zone_id=zone.id,
        )
        tool = await svc.create_equipment(company_id=company_id, name="E2E equipment", equipment_type="demo")
        await svc.create_ble_device(
            company_id=company_id,
            name="E2 worker tag",
            mac_address=worker_mac,
            ble_type="worker_tag",
            assigned_worker_id=user_id,
        )
        ble_eq = await svc.create_ble_device(
            company_id=company_id,
            name="E2 equipment tag",
            mac_address=equip_mac,
            ble_type="equipment_tag",
        )
        await svc.link_ble_to_equipment(company_id=company_id, ble_id=ble_eq.id, equipment_id=tool.id)
        zone_id = zone.id
        tool_id = tool.id
        gateway_id = gw.id
        await db.commit()

    entity_key = f"worker:{user_id}|equipment:{tool_id}"

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

    async def ingest(raw: dict) -> AutomationEvent:
        async with AsyncSessionLocal() as db:
            row = AutomationEvent(
                company_id=company_id,
                event_type=str(raw["event_type"]),
                payload=dict(raw),
            )
            db.add(row)
            await db.flush()
            er = await enrich_event(db, row)
            if er.process:
                await process_event(db, row)
            await db.commit()
            await db.refresh(row)
            return row

    base_raw = {
        "event_type": "proximity_update",
        "company_id": company_id,
        "gateway_id": gateway_id,
        "worker_tag_mac": worker_mac,
        "equipment_tag_mac": equip_mac,
        "distance": "near",
    }

    await ingest({**base_raw, "movement": "stationary", "timestamp": t0})
    await ingest({**base_raw, "movement": "stationary", "timestamp": t0 + 12.0})
    r = await ingest({**base_raw, "movement": "moving", "timestamp": t0 + 25.0})

    async with AsyncSessionLocal() as db:
        persisted = (await db.execute(select(AutomationEvent).where(AutomationEvent.id == r.id))).scalar_one()
        if persisted.payload.get("worker_id") != user_id:
            print("Persisted payload missing worker_id", persisted.payload)
            raise SystemExit(5)
        if persisted.payload.get("equipment_id") != tool_id:
            print("equipment_id mismatch", persisted.payload.get("equipment_id"), tool_id)
            raise SystemExit(5)
        if persisted.payload.get("zone_id") != zone_id:
            print("zone_id mismatch", persisted.payload.get("zone_id"), zone_id)
            raise SystemExit(5)
        nrows = list(
            (
                await db.execute(
                    select(AutomationNotification).where(
                        AutomationNotification.company_id == company_id,
                        AutomationNotification.user_id == user_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        sq = await db.execute(
            select(AutomationStateTracking).where(
                AutomationStateTracking.company_id == company_id,
                AutomationStateTracking.entity_key == entity_key,
            )
        )
        st_row = sq.scalar_one_or_none()

    if not r.payload.get("worker_id"):
        print("Enrichment failed: expected worker_id on payload", r.payload)
        raise SystemExit(2)
    if len(nrows) != 1:
        print(f"Expected 1 notification, got {len(nrows)}")
        raise SystemExit(3)
    if not st_row or not st_row.state.get("last_event_id"):
        print("Expected state with last_event_id", st_row.state if st_row else None)
        raise SystemExit(4)

    print("OK enriched proximity pipeline:", r.id, r.payload.get("enrichment_warnings") or "no warnings")


if __name__ == "__main__":
    asyncio.run(main())
