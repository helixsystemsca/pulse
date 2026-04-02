"""
Exercise deduplication (incl. timestamp fallback), dual-axis rate limiting, proximity
signal handling, active_session, and state timeout.

Prereqs: DATABASE_URL, alembic upgrade head (0017+).

Env:
  AUTOMATION_DEMO_COMPANY_ID
  AUTOMATION_DEMO_USER_ID

Usage:
  python -m scripts.run_automation_hardening_demo
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

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
    from app.models.automation_engine import AutomationEvent, AutomationLog, AutomationNotification, AutomationStateTracking
    from app.models.device_hub import AutomationBleDevice, AutomationGateway
    from app.services.automation.event_enricher import enrich_event
    from app.services.automation.event_processor import process_event
    from app.services.automation.ingest_helpers import build_idempotency_key, find_event_by_idempotency
    from app.services.automation.state_manager import load_state, save_state
    from app.services.devices.device_service import DeviceService

    worker_mac = "AA:BB:CC:DD:BB:01"
    equip_mac = "AA:BB:CC:DD:BB:02"
    equip_mac_2 = "AA:BB:CC:DD:BB:99"
    gw_ident = f"harden-gw-{uuid4().hex[:8]}"
    t_ms = 1_720_500_000_000.0

    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(AutomationBleDevice).where(
                AutomationBleDevice.company_id == company_id,
                AutomationBleDevice.mac_address.in_((worker_mac, equip_mac, equip_mac_2)),
            )
        )
        await db.execute(
            delete(AutomationGateway).where(
                AutomationGateway.company_id == company_id,
                AutomationGateway.identifier.like("harden-gw-%"),
            )
        )
        await db.commit()

        svc = DeviceService(db)
        zone = await svc.create_zone(company_id=company_id, name="Hardening zone")
        gw = await svc.create_gateway(
            company_id=company_id,
            name="Hardening GW",
            identifier=gw_ident,
            zone_id=zone.id,
        )
        tool = await svc.create_equipment(company_id=company_id, name="Hardening tool")
        tool2 = await svc.create_equipment(company_id=company_id, name="Hardening tool 2")
        await svc.create_ble_device(
            company_id=company_id,
            name="HW",
            mac_address=worker_mac,
            ble_type="worker_tag",
            assigned_worker_id=user_id,
        )
        ble_eq = await svc.create_ble_device(
            company_id=company_id,
            name="HE",
            mac_address=equip_mac,
            ble_type="equipment_tag",
        )
        await svc.link_ble_to_equipment(company_id=company_id, ble_id=ble_eq.id, equipment_id=tool.id)
        ble_eq2 = await svc.create_ble_device(
            company_id=company_id,
            name="HE2",
            mac_address=equip_mac_2,
            ble_type="equipment_tag",
        )
        await svc.link_ble_to_equipment(company_id=company_id, ble_id=ble_eq2.id, equipment_id=tool2.id)
        await db.commit()
        gateway_id = gw.id
        tool_id = tool.id
        zone_id = zone.id

    entity_key = f"worker:{user_id}|equipment:{tool_id}"

    base = {
        "event_type": "proximity_update",
        "company_id": company_id,
        "gateway_id": gateway_id,
        "worker_tag_mac": worker_mac,
        "equipment_tag_mac": equip_mac,
        "distance": "near",
        "rssi": -67,
    }

    async def cleanup_state() -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(AutomationStateTracking).where(AutomationStateTracking.company_id == company_id))
            await db.execute(
                delete(AutomationNotification).where(
                    AutomationNotification.company_id == company_id,
                    AutomationNotification.user_id == user_id,
                )
            )
            await db.execute(delete(AutomationLog).where(AutomationLog.company_id == company_id))
            await db.execute(delete(AutomationEvent).where(AutomationEvent.company_id == company_id))
            await db.commit()

    await cleanup_state()

    # --- 0) Idempotency fallback (no timestamp) ---
    fb_payload = {**base, "movement": "stationary"}
    if "timestamp" in fb_payload:
        del fb_payload["timestamp"]
    kfb = build_idempotency_key(fb_payload)
    if not kfb.startswith("fb:"):
        print("fallback idempotency key should start with fb:", kfb)
        raise SystemExit(20)

    async with AsyncSessionLocal() as db:
        fb_row = AutomationEvent(
            company_id=company_id,
            event_type="proximity_update",
            payload=dict(fb_payload),
            idempotency_key=kfb,
        )
        db.add(fb_row)
        await db.flush()
        await enrich_event(db, fb_row)
        await db.commit()
        fb_dup = AutomationEvent(
            company_id=company_id,
            event_type="proximity_update",
            payload=dict(fb_payload),
            idempotency_key=kfb,
        )
        db.add(fb_dup)
        try:
            await db.flush()
            await db.commit()
            print("expected unique violation for fallback idempotency duplicate")
            raise SystemExit(21)
        except IntegrityError:
            await db.rollback()

    await cleanup_state()

    # --- 1) Deduplication with device timestamp ---
    dup_payload = {**base, "movement": "stationary", "timestamp": t_ms}
    idem = build_idempotency_key(dup_payload)

    async with AsyncSessionLocal() as db:
        ex0 = await find_event_by_idempotency(db, company_id=company_id, idempotency_key=idem)
        if ex0 is not None:
            print("stale idempotency row from previous run")
            raise SystemExit(2)
        r1 = AutomationEvent(
            company_id=company_id,
            event_type="proximity_update",
            payload=dict(dup_payload),
            idempotency_key=idem,
        )
        db.add(r1)
        await db.flush()
        e1 = await enrich_event(db, r1)
        if e1.process:
            await process_event(db, r1)
        await db.commit()
        r1_id = r1.id

    async with AsyncSessionLocal() as db:
        ex1 = await find_event_by_idempotency(db, company_id=company_id, idempotency_key=idem)
        if ex1 is None or ex1.id != r1_id:
            print("dedup lookup failed")
            raise SystemExit(3)

    async with AsyncSessionLocal() as db:
        cnt_before = (
            await db.execute(select(func.count()).select_from(AutomationEvent).where(AutomationEvent.company_id == company_id))
        ).scalar_one()
        r_dup = AutomationEvent(
            company_id=company_id,
            event_type="proximity_update",
            payload=dict(dup_payload),
            idempotency_key=idem,
        )
        db.add(r_dup)
        try:
            await db.flush()
            await db.commit()
            print("expected DB unique violation on duplicate idempotency_key")
            raise SystemExit(4)
        except IntegrityError:
            await db.rollback()

    async with AsyncSessionLocal() as db:
        cnt_after = (
            await db.execute(select(func.count()).select_from(AutomationEvent).where(AutomationEvent.company_id == company_id))
        ).scalar_one()
    if cnt_after != cnt_before:
        print("event count changed after failed duplicate insert", cnt_before, cnt_after)
        raise SystemExit(4)

    # --- 2) Rate limit: same gateway + same tags → second event debounced ---
    await cleanup_state()
    rl_ts = 1_720_600_000_000.0
    p_fast_a = {**base, "movement": "stationary", "timestamp": rl_ts}
    p_fast_b = {**base, "movement": "stationary", "timestamp": rl_ts + 1}

    async with AsyncSessionLocal() as db:
        for pl in (p_fast_a, p_fast_b):
            row = AutomationEvent(
                company_id=company_id,
                event_type="proximity_update",
                payload=dict(pl),
            )
            db.add(row)
            await db.flush()
            er = await enrich_event(db, row)
            if pl is p_fast_a and not er.process:
                print("first event should process")
                raise SystemExit(5)
            if pl is p_fast_b:
                if er.process or not er.rate_limited:
                    print("second event should be rate_limited", er)
                    raise SystemExit(5)
            if er.process:
                await process_event(db, row)
        await db.commit()

    # --- 2b) Same gateway, different equipment tag → both process quickly ---
    await cleanup_state()
    rl2 = 1_720_610_000_000.0
    p_dev1 = {**base, "equipment_tag_mac": equip_mac, "movement": "stationary", "timestamp": rl2}
    p_dev2 = {
        **base,
        "equipment_tag_mac": equip_mac_2,
        "movement": "stationary",
        "timestamp": rl2 + 1,
    }

    async with AsyncSessionLocal() as db:
        for pl in (p_dev1, p_dev2):
            row = AutomationEvent(company_id=company_id, event_type="proximity_update", payload=dict(pl))
            db.add(row)
            await db.flush()
            er = await enrich_event(db, row)
            if not er.process or er.rate_limited:
                print("dual-axis rate limit should allow different tag pair", pl, er)
                raise SystemExit(15)
            await process_event(db, row)
        await db.commit()

    # --- 3) Confidence: near → medium → near → still triggers ---
    await cleanup_state()
    seq_ts = 1_720_700_000_000.0

    async def ingest_one(pl: dict) -> None:
        async with AsyncSessionLocal() as db:
            row = AutomationEvent(
                company_id=company_id,
                event_type="proximity_update",
                payload=dict(pl),
            )
            db.add(row)
            await db.flush()
            er = await enrich_event(db, row)
            if er.process:
                await process_event(db, row)
            await db.commit()

    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts})
    await ingest_one({**base, "distance": "medium", "movement": "stationary", "timestamp": seq_ts + 1000})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 2000})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 14000})
    await ingest_one({**base, "distance": "near", "movement": "moving", "timestamp": seq_ts + 27000})

    async with AsyncSessionLocal() as db:
        nn = (
            await db.execute(
                select(func.count()).select_from(AutomationNotification).where(
                    AutomationNotification.company_id == company_id,
                    AutomationNotification.user_id == user_id,
                )
            )
        ).scalar_one()
    if nn != 1:
        print(f"confidence path: expected 1 notification, got {nn}")
        raise SystemExit(6)

    # --- 4) active_session blocks re-fire until far ---
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 30_000})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 31_000})
    await ingest_one({**base, "distance": "near", "movement": "moving", "timestamp": seq_ts + 45_000})
    async with AsyncSessionLocal() as db:
        nn2 = (
            await db.execute(
                select(func.count()).select_from(AutomationNotification).where(
                    AutomationNotification.company_id == company_id,
                    AutomationNotification.user_id == user_id,
                )
            )
        ).scalar_one()
    if nn2 != 1:
        print(f"active_session should block second trigger, got {nn2} notifications")
        raise SystemExit(16)

    await ingest_one({**base, "distance": "far", "movement": "moving", "timestamp": seq_ts + 50_000})
    await ingest_one({**base, "distance": "far", "movement": "moving", "timestamp": seq_ts + 50_500})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 51_000})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": seq_ts + 63_000})
    await ingest_one({**base, "distance": "near", "movement": "moving", "timestamp": seq_ts + 76_000})
    async with AsyncSessionLocal() as db:
        nn3 = (
            await db.execute(
                select(func.count()).select_from(AutomationNotification).where(
                    AutomationNotification.company_id == company_id,
                    AutomationNotification.user_id == user_id,
                )
            )
        ).scalar_one()
    if nn3 != 2:
        print(f"after far reset expected 2 notifications, got {nn3}")
        raise SystemExit(17)

    # --- 5) State timeout clears stale row ---
    await cleanup_state()
    async with AsyncSessionLocal() as db:
        await save_state(
            db,
            company_id,
            entity_key,
            {"near_count": 99, "last_activity_at": 0.0, "bogus": True},
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        row = AutomationEvent(
            company_id=company_id,
            event_type="proximity_update",
            payload=dict({**base, "movement": "stationary", "timestamp": seq_ts + 100_000}),
        )
        db.add(row)
        await db.flush()
        er = await enrich_event(db, row)
        if er.process:
            await process_event(db, row)
        await db.commit()

    async with AsyncSessionLocal() as db:
        st = await load_state(db, company_id, entity_key)
    if int(st.get("near_count") or 0) != 1:
        print("timeout reset: expected near_count 1 after stale state", st)
        raise SystemExit(7)

    async with AsyncSessionLocal() as db:
        sev = (
            await db.execute(
                select(func.count()).select_from(AutomationLog).where(AutomationLog.company_id == company_id)
            )
        ).scalar_one()
    if sev < 1:
        print("expected at least one automation_logs row with severity/source_module")
        raise SystemExit(18)

    # --- 6) Final reliability: ordering, session max, zone mismatch, weak buffer, far debounce ---
    await cleanup_state()
    tq = 2_000_000_000.0

    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 100})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 50})
    async with AsyncSessionLocal() as db:
        st_ord = await load_state(db, company_id, entity_key)
    if int(st_ord.get("near_count") or 0) != 1:
        print("out-of-order event should be ignored", st_ord)
        raise SystemExit(30)

    await cleanup_state()
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 200})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 212})
    await ingest_one({**base, "distance": "near", "movement": "moving", "timestamp": tq + 225})
    async with AsyncSessionLocal() as db:
        await save_state(
            db,
            company_id,
            entity_key,
            {
                "active_session": True,
                "session_started_at": tq,
                "session_started_wall": time.time() - 400,
                "zone_id": zone_id,
                "last_activity_at": time.time(),
                "last_event_ts": tq + 300,
                "last_movement": "moving",
            },
        )
        await db.commit()
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 400})
    async with AsyncSessionLocal() as db:
        rmax = await db.execute(select(AutomationLog).where(AutomationLog.type == "session_max_exceeded"))
        if not rmax.scalars().first():
            print("expected session_max_exceeded log")
            raise SystemExit(31)

    await cleanup_state()
    zone2 = None
    async with AsyncSessionLocal() as db:
        svc2 = DeviceService(db)
        z2 = await svc2.create_zone(company_id=company_id, name="Hardening zone B")
        zone2 = z2.id
        await db.commit()
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 500})
    base_no_gw = {k: v for k, v in base.items() if k != "gateway_id"}
    await ingest_one(
        {
            **base_no_gw,
            "distance": "near",
            "movement": "stationary",
            "timestamp": tq + 512,
            "zone_id": zone2,
        }
    )
    async with AsyncSessionLocal() as db:
        zm = await db.execute(select(AutomationLog).where(AutomationLog.type == "zone_mismatch_reset"))
        if not zm.scalars().first():
            print("expected zone_mismatch_reset log")
            raise SystemExit(32)

    await cleanup_state()
    for i in range(4):
        await ingest_one(
            {**base, "distance": "medium", "movement": "stationary", "timestamp": tq + 600 + i * 1000}
        )
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 11_000})
    await ingest_one({**base, "distance": "near", "movement": "moving", "timestamp": tq + 23_000})
    async with AsyncSessionLocal() as db:
        nw = (
            await db.execute(
                select(func.count()).select_from(AutomationNotification).where(
                    AutomationNotification.company_id == company_id,
                )
            )
        ).scalar_one()
    if nw < 1:
        print("weak-signal buffer should allow trigger", nw)
        raise SystemExit(33)

    await cleanup_state()
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 20_000})
    await ingest_one({**base, "distance": "near", "movement": "stationary", "timestamp": tq + 20_012})
    await ingest_one({**base, "distance": "far", "movement": "moving", "timestamp": tq + 20_020})
    async with AsyncSessionLocal() as db:
        st1far = await load_state(db, company_id, entity_key)
    if st1far == {} or int(st1far.get("near_count") or 0) < 2:
        print("single far should not wipe dwell state", st1far)
        raise SystemExit(34)
    await ingest_one({**base, "distance": "far", "movement": "moving", "timestamp": tq + 20_030})
    async with AsyncSessionLocal() as db:
        st2far = await load_state(db, company_id, entity_key)
    if st2far != {}:
        print("double far should reset state", st2far)
        raise SystemExit(35)

    async with AsyncSessionLocal() as db:
        sev_final = (
            await db.execute(
                select(func.count()).select_from(AutomationLog).where(AutomationLog.company_id == company_id)
            )
        ).scalar_one()
    print("OK hardening v3:", gateway_id, zone_id, "logs:", sev_final)


if __name__ == "__main__":
    asyncio.run(main())
