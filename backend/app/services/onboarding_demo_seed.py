"""Idempotent demo monitoring facility + sensor readings for onboarding."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitoring_models import MonitoringFacility, MonitoringZone, MonitoredSystem, Sensor, SensorReading


DEMO_SUPPLY_KEY = "helix_demo_supply_temp"
DEMO_RETURN_KEY = "helix_demo_return_temp"
DEMO_FLOOR_KEY = "helix_demo_floor_temp"


async def ensure_demo_monitoring_data(db: AsyncSession, company_id: str) -> None:
    """Create a small monitoring graph and ~48h of numeric readings if not already present."""
    cid = company_id

    exists_q = await db.scalar(
        select(func.count())
        .select_from(Sensor)
        .join(MonitoredSystem, MonitoredSystem.id == Sensor.monitored_system_id)
        .join(MonitoringFacility, MonitoringFacility.id == MonitoredSystem.facility_id)
        .where(MonitoringFacility.company_id == cid, Sensor.external_key == DEMO_SUPPLY_KEY)
        .limit(1)
    )
    if int(exists_q or 0) > 0:
        return

    fac = MonitoringFacility(
        id=str(uuid4()),
        company_id=cid,
        name="Demo facility",
        description="Sample data for onboarding — safe to delete later.",
    )
    db.add(fac)
    await db.flush()

    zone = MonitoringZone(
        id=str(uuid4()),
        facility_id=fac.id,
        parent_zone_id=None,
        name="Demo floor",
        code="DEMO",
    )
    db.add(zone)
    await db.flush()

    system = MonitoredSystem(
        id=str(uuid4()),
        facility_id=fac.id,
        zone_id=zone.id,
        name="Demo air handler",
        description="Simulated HVAC loop for charts.",
    )
    db.add(system)
    await db.flush()

    sensors_spec = [
        (DEMO_SUPPLY_KEY, "Supply air temp", "°F"),
        (DEMO_RETURN_KEY, "Return air temp", "°F"),
        (DEMO_FLOOR_KEY, "Floor zone temp", "°F"),
    ]
    sensors: list[Sensor] = []
    for ext_key, name, unit in sensors_spec:
        s = Sensor(
            id=str(uuid4()),
            monitored_system_id=system.id,
            zone_id=zone.id,
            name=name,
            external_key=ext_key,
            unit=unit,
            expected_interval_seconds=300,
        )
        db.add(s)
        sensors.append(s)
    await db.flush()

    now = datetime.now(timezone.utc)
    readings: list[dict] = []
    for sensor in sensors:
        ext = sensor.external_key or ""
        if ext == DEMO_RETURN_KEY:
            base = 71.0
        elif ext == DEMO_FLOOR_KEY:
            base = 66.0
        else:
            base = 68.0
        for h in range(48, 0, -1):
            t = now - timedelta(hours=h)
            wobble = (h % 5) * 0.35
            val = Decimal(str(round(base + wobble, 2)))
            readings.append(
                {
                    "id": str(uuid4()),
                    "sensor_id": sensor.id,
                    "observed_at": t,
                    "value_num": val,
                    "value_bool": None,
                    "value_text": None,
                    "received_at": now,
                }
            )

    if readings:
        await db.execute(insert(SensorReading), readings)
    await db.flush()
