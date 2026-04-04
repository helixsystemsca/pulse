"""Alert generation from simulated sensor readings (threshold engine)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitoring_models import AlertSeverity, AlertStatus, MonitoringAlert

from tests.conftest import auth_headers


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


@pytest.mark.asyncio
async def test_normal_reading_no_alert(client, seeded_tenant, db_session: AsyncSession) -> None:
    observed = datetime.now(timezone.utc)
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_ok_id,
                    "observed_at": _iso(observed),
                    "value_num": "70",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 200, f"PIPELINE: alert logic — {r.text}"

    q = await db_session.execute(
        select(MonitoringAlert).where(MonitoringAlert.sensor_id == seeded_tenant.sensor_ok_id)
    )
    assert q.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_warning_threshold_opens_warning_alert(client, seeded_tenant, db_session: AsyncSession) -> None:
    observed = datetime.now(timezone.utc)
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_warn_id,
                    "observed_at": _iso(observed),
                    "value_num": "90",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 200, f"PIPELINE: alert logic — {r.text}"

    q = await db_session.execute(
        select(MonitoringAlert).where(
            MonitoringAlert.sensor_id == seeded_tenant.sensor_warn_id,
            MonitoringAlert.status == AlertStatus.open,
        )
    )
    alert = q.scalar_one_or_none()
    assert alert is not None
    assert alert.severity == AlertSeverity.warning
    assert alert.threshold_id is not None


@pytest.mark.asyncio
async def test_critical_threshold_opens_critical_alert(client, seeded_tenant, db_session: AsyncSession) -> None:
    observed = datetime.now(timezone.utc)
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_crit_id,
                    "observed_at": _iso(observed),
                    "value_num": "99",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 200, f"PIPELINE: alert logic — {r.text}"

    q = await db_session.execute(
        select(MonitoringAlert).where(
            MonitoringAlert.sensor_id == seeded_tenant.sensor_crit_id,
            MonitoringAlert.status == AlertStatus.open,
        )
    )
    alert = q.scalar_one_or_none()
    assert alert is not None
    assert alert.severity == AlertSeverity.critical


@pytest.mark.asyncio
async def test_list_alerts_api_matches_db(client, seeded_tenant) -> None:
    observed = datetime.now(timezone.utc)
    await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_warn_id,
                    "observed_at": _iso(observed),
                    "value_num": "95",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )

    r = await client.get(
        "/api/v1/monitoring/alerts?status=open",
        headers=auth_headers(seeded_tenant.worker_token),
    )
    assert r.status_code == 200, f"PIPELINE: alerts API — {r.text}"
    items = r.json()
    assert isinstance(items, list)
    assert any(a["sensor_id"] == seeded_tenant.sensor_warn_id for a in items)
    for a in items:
        assert "id" in a
        assert "severity" in a
        assert "status" in a
        assert "opened_at" in a
        assert "updated_at" in a
