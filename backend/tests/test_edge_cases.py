"""Edge cases: duplicates, validation, RBAC boundaries."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_duplicate_sensor_reading_idempotent_upsert(client, seeded_tenant) -> None:
    observed = datetime.now(timezone.utc).replace(microsecond=0)
    body = {
        "readings": [
            {
                "sensor_id": seeded_tenant.sensor_ok_id,
                "observed_at": observed.isoformat(),
                "value_num": "50",
            }
        ]
    }
    h = {**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"}
    r1 = await client.post("/api/v1/monitoring/readings/batch", json=body, headers=h)
    r2 = await client.post("/api/v1/monitoring/readings/batch", json=body, headers=h)
    assert r1.status_code == 200 and r2.status_code == 200
    # Both calls succeed; second updates same (sensor_id, observed_at) row.
    assert r1.json()["inserted"] == 1 and r2.json()["inserted"] == 1


@pytest.mark.asyncio
async def test_extreme_numeric_rejected_or_accepted(client, seeded_tenant) -> None:
    observed = datetime.now(timezone.utc).replace(microsecond=0)
    r = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_ok_id,
                    "observed_at": observed.isoformat(),
                    "value_num": "1e40",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code in (200, 422), f"PIPELINE: ingestion — unexpected {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_worker_blocked_from_non_attachment_patch(client, seeded_tenant) -> None:
    cr = await client.post(
        "/api/work-requests",
        json={
            "title": "Assigned WR",
            "priority": "low",
            "assigned_user_id": seeded_tenant.worker_id,
        },
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert cr.status_code == 201
    wr_id = cr.json()["id"]
    pr = await client.patch(
        f"/api/work-requests/{wr_id}",
        json={"title": "Worker cannot rename"},
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert pr.status_code == 403, f"PIPELINE: issues API — {pr.text}"
