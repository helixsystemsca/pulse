"""Simulated device + sensor ingestion (no physical hardware)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.models.monitoring_models import SensorReading

from tests.conftest import auth_headers, device_headers


@pytest.mark.asyncio
async def test_monitoring_batch_stores_reading(client, seeded_tenant, db_session: AsyncSession) -> None:
    observed = datetime.now(timezone.utc).replace(microsecond=0)
    body = {
        "readings": [
            {
                "sensor_id": seeded_tenant.sensor_ok_id,
                "observed_at": observed.isoformat(),
                "value_num": "55.5",
            }
        ]
    }
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json=body,
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 200, f"PIPELINE: ingestion — {r.status_code} {r.text}"
    assert r.json()["inserted"] == 1
    assert r.json()["skipped_invalid_sensor"] == 0

    q = await db_session.execute(
        select(func.count()).select_from(SensorReading).where(SensorReading.sensor_id == seeded_tenant.sensor_ok_id)
    )
    assert (q.scalar_one() or 0) >= 1


@pytest.mark.asyncio
async def test_device_gateway_ingest_authenticated(client, seeded_tenant, db_session: AsyncSession) -> None:
    r = await client.post(
        "/api/v1/device/events",
        json={"event_type": "simulated_telemetry", "payload": {"pressure_psi": 42.0}},
        headers=device_headers(seeded_tenant.gateway_id, seeded_tenant.gateway_secret),
    )
    assert r.status_code == 200, f"PIPELINE: ingestion — {r.status_code} {r.text}"
    data = r.json()
    assert "id" in data

    row = await db_session.get(AutomationEvent, data["id"])
    assert row is not None
    assert row.event_type == "simulated_telemetry"


@pytest.mark.asyncio
async def test_device_ingest_invalid_secret_rejected(client, seeded_tenant) -> None:
    r = await client.post(
        "/api/v1/device/events",
        json={"event_type": "x"},
        headers=device_headers(seeded_tenant.gateway_id, "wrong-secret"),
    )
    assert r.status_code == 401, f"PIPELINE: ingestion — {r.text}"


@pytest.mark.asyncio
async def test_monitoring_batch_rejects_unknown_sensor(client, seeded_tenant) -> None:
    observed = datetime.now(timezone.utc).replace(microsecond=0)
    body = {
        "readings": [
            {
                "sensor_id": "00000000-0000-0000-0000-000000000001",
                "observed_at": observed.isoformat(),
                "value_num": "1",
            }
        ]
    }
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json=body,
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    assert r.json()["inserted"] == 0
    assert r.json()["skipped_invalid_sensor"] == 1


@pytest.mark.asyncio
async def test_monitoring_batch_validation_error(client, seeded_tenant) -> None:
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={"readings": "not-a-list"},
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 422, f"PIPELINE: ingestion — expected validation error, got {r.status_code}"
