"""
End-to-end simulated pipeline:

  sensor reading → monitoring alert → (manual) work request → list → resolve

Automatic creation of work requests from alerts is not implemented; this flow
explicitly creates the issue after the alert, matching realistic operator action.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_full_simulated_device_to_resolved_issue(client, seeded_tenant) -> None:
    # 1) Ingest simulated pressure (violates warning threshold on sensor_warn)
    observed = datetime.now(timezone.utc).replace(microsecond=0)
    ing = await client.post(
        "/api/v1/monitoring/readings/batch",
        json={
            "readings": [
                {
                    "sensor_id": seeded_tenant.sensor_warn_id,
                    "observed_at": observed.isoformat(),
                    "value_num": "88",
                }
            ]
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert ing.status_code == 200, f"STEP 1 ingestion failed: {ing.text}"

    # 2) Alert visible via API
    al = await client.get(
        "/api/v1/monitoring/alerts?status=open",
        headers=auth_headers(seeded_tenant.worker_token),
    )
    assert al.status_code == 200, f"STEP 2 alerts API failed: {al.text}"
    alerts = al.json()
    match = next((a for a in alerts if a["sensor_id"] == seeded_tenant.sensor_warn_id), None)
    assert match is not None, "PIPELINE: alert logic — no open alert for sensor"
    alert_id = match["id"]

    # 3) Create linked issue (simulated automation / operator)
    issue = await client.post(
        "/api/work-requests",
        json={
            "title": f"Alert follow-up {alert_id[:8]}",
            "description": f"Opened from monitoring alert {alert_id}",
            "priority": "high",
            "category": "monitoring",
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert issue.status_code == 201, f"STEP 3 issue create failed: {issue.text}"
    wr = issue.json()
    assert wr["status"] == "open"
    wr_id = wr["id"]

    # 4) Fetch issues list — frontend/mobile compatibility fields
    lst = await client.get("/api/work-requests", headers=auth_headers(seeded_tenant.worker_token))
    assert lst.status_code == 200
    ids = {i["id"] for i in lst.json()["items"]}
    assert wr_id in ids

    # 5) Resolve via manager patch
    res = await client.patch(
        f"/api/work-requests/{wr_id}",
        json={"status": "completed"},
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert res.status_code == 200, f"STEP 5 resolve failed: {res.text}"
    assert res.json()["status"] == "completed"
