"""
Exercise operational APIs: proximity → session timeline, notification ack, debug reads, gateway status.

Prereqs: DATABASE_URL, alembic upgrade head.

Env:
  AUTOMATION_DEMO_COMPANY_ID  (required)
  AUTOMATION_DEMO_USER_ID     (required) — worker assigned to the demo BLE tag; receives notification
  Optional: AUTOMATION_DEMO_MANAGER_ID — if set, HTTP calls use this user (manager+). Otherwise picks
            first manager/company_admin in the company from the DB.

Usage:
  python -m scripts.run_operational_debug_demo
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from httpx import ASGITransport
from sqlalchemy import delete, desc, select
from sqlalchemy.exc import IntegrityError

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv(_ROOT / ".env")


async def main() -> None:
    company_id = os.environ.get("AUTOMATION_DEMO_COMPANY_ID", "").strip()
    worker_id = os.environ.get("AUTOMATION_DEMO_USER_ID", "").strip()
    manager_id_override = os.environ.get("AUTOMATION_DEMO_MANAGER_ID", "").strip()
    if not company_id or not worker_id:
        print("Set AUTOMATION_DEMO_COMPANY_ID and AUTOMATION_DEMO_USER_ID.")
        raise SystemExit(1)

    from app.api.deps import get_current_user
    from app.main import app
    from app.core.database import AsyncSessionLocal
    from app.models.automation_engine import AutomationEvent, AutomationNotification
    from app.models.device_hub import AutomationBleDevice, AutomationGateway
    from app.models.domain import User, UserRole
    from app.services.automation.event_enricher import enrich_event
    from app.services.automation.event_processor import process_event
    from app.services.automation.ingest_helpers import build_idempotency_key
    from app.services.devices.device_service import DeviceService

    worker_mac = "AA:BB:CC:DD:EE:20"
    equip_mac = "AA:BB:CC:DD:EE:21"
    gw_ident = f"opdebug-gw-{uuid4().hex[:8]}"
    base_ts = 2_100_000_000.0

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
                AutomationGateway.identifier.like("opdebug-gw-%"),
            )
        )
        await db.commit()

        svc = DeviceService(db)
        zone = await svc.create_zone(company_id=company_id, name="OpDebug zone")
        gw = await svc.create_gateway(
            company_id=company_id,
            name="OpDebug GW",
            identifier=gw_ident,
            zone_id=zone.id,
        )
        tool = await svc.create_equipment(company_id=company_id, name="OpDebug equipment")
        await svc.create_ble_device(
            company_id=company_id,
            name="OpDebug worker tag",
            mac_address=worker_mac,
            ble_type="worker_tag",
            assigned_worker_id=worker_id,
        )
        ble_eq = await svc.create_ble_device(
            company_id=company_id,
            name="OpDebug equip tag",
            mac_address=equip_mac,
            ble_type="equipment_tag",
        )
        await svc.link_ble_to_equipment(company_id=company_id, ble_id=ble_eq.id, equipment_id=tool.id)
        await db.commit()
        gateway_id = gw.id
        tool_id = tool.id
        zone_id = zone.id

        if manager_id_override:
            qm = await db.execute(select(User).where(User.id == manager_id_override))
            api_user = qm.scalar_one_or_none()
        else:
            qm = await db.execute(
                select(User).where(
                    User.company_id == company_id,
                    User.role.in_((UserRole.manager, UserRole.company_admin)),
                    User.is_active.is_(True),
                )
            )
            api_user = qm.scalars().first()

        if api_user is None:
            print("No manager/company_admin user for HTTP demo; set AUTOMATION_DEMO_MANAGER_ID")
            raise SystemExit(2)

    base = {
        "event_type": "proximity_update",
        "company_id": company_id,
        "gateway_id": gateway_id,
        "worker_tag_mac": worker_mac,
        "equipment_tag_mac": equip_mac,
        "distance": "near",
        "movement": "stationary",
        "rssi": -65,
    }

    async def ingest_one(payload: dict) -> str:
        pl = dict(payload)
        idem = build_idempotency_key(pl)
        async with AsyncSessionLocal() as db:
            row = AutomationEvent(
                company_id=company_id,
                event_type=str(pl["event_type"]),
                payload=pl,
                idempotency_key=idem,
            )
            db.add(row)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                return "dedup"
            er = await enrich_event(db, row)
            if er.process:
                await process_event(db, row)
            await db.commit()
            return row.id

    await ingest_one({**base, "timestamp": base_ts + 1_000})
    await ingest_one({**base, "timestamp": base_ts + 2_000})
    await ingest_one({**base, "movement": "moving", "timestamp": base_ts + 15_000})

    notif_id: str | None = None
    async with AsyncSessionLocal() as db:
        qn = (
            await db.execute(
                select(AutomationNotification)
                .where(
                    AutomationNotification.company_id == company_id,
                    AutomationNotification.user_id == worker_id,
                )
                .order_by(desc(AutomationNotification.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()
        if qn:
            notif_id = qn.id

    if not notif_id:
        print("expected a signout_prompt notification")
        raise SystemExit(3)

    async def override_current_user() -> User:
        async with AsyncSessionLocal() as db:
            u = (await db.execute(select(User).where(User.id == api_user.id))).scalar_one()
            return u

    app.dependency_overrides[get_current_user] = override_current_user
    transport = ASGITransport(app=app, lifespan="on")
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r_act = await client.get(
            "/api/v1/automation/debug/recent-activity",
            params={"company_id": company_id} if api_user.role == UserRole.system_admin else {},
        )
        if r_act.status_code != 200:
            print("recent-activity", r_act.status_code, r_act.text)
            raise SystemExit(4)
        body = r_act.json()
        if not body.get("success") or "events" not in body.get("data", {}):
            print("unexpected recent-activity envelope", body)
            raise SystemExit(5)
        types = {e["event_type"] for e in body["data"]["events"]}
        if "session_started" not in types and "proximity_update" not in types:
            print("recent activity missing expected event types", types)
            raise SystemExit(6)

        r_state = await client.get(
            "/api/v1/automation/debug/state",
            params={
                "worker_id": worker_id,
                "equipment_id": tool_id,
            },
        )
        if r_state.status_code != 200:
            print("state", r_state.status_code, r_state.text)
            raise SystemExit(7)
        st_body = r_state.json()
        if not st_body.get("success"):
            print(st_body)
            raise SystemExit(8)
        if "state" not in st_body.get("data", {}):
            print("state envelope", st_body)
            raise SystemExit(9)

        r_gw = await client.get("/api/v1/gateways/status")
        if r_gw.status_code != 200:
            print("gateways/status", r_gw.status_code, r_gw.text)
            raise SystemExit(10)
        gw_body = r_gw.json()
        if not gw_body.get("success") or not isinstance(gw_body.get("data"), list):
            print("gateways/status envelope", gw_body)
            raise SystemExit(11)
        if not any(g.get("id") == gateway_id for g in gw_body["data"]):
            print("gateway not in status list", gw_body["data"])
            raise SystemExit(12)

        async def override_worker_user() -> User:
            async with AsyncSessionLocal() as db:
                return (await db.execute(select(User).where(User.id == worker_id))).scalar_one()

        app.dependency_overrides[get_current_user] = override_worker_user
        r_ack = await client.post(f"/api/v1/notifications/{notif_id}/acknowledge")
        if r_ack.status_code != 200:
            print("ack", r_ack.status_code, r_ack.text)
            raise SystemExit(13)
        ack_j = r_ack.json()
        if not ack_j.get("success") or not ack_j.get("data", {}).get("ok"):
            print(ack_j)
            raise SystemExit(14)

    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        ack_ev = (
            await db.execute(
                select(AutomationEvent)
                .where(
                    AutomationEvent.company_id == company_id,
                    AutomationEvent.event_type == "notification_acknowledged",
                )
                .order_by(desc(AutomationEvent.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()
        if ack_ev is None:
            print("missing notification_acknowledged automation_event")
            raise SystemExit(15)

    print("OK operational debug demo", gw_ident, "notification", notif_id)


if __name__ == "__main__":
    asyncio.run(main())
