"""POST/GET schedule shifts return training alarms without blocking the assignment."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseWorkerCertification
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_assign_unqualified_worker_warns_and_qualified_is_clean(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    headers = auth_headers(seeded_tenant.manager_token)

    fac = await client.get("/api/v1/pulse/schedule-facilities", headers=headers)
    assert fac.status_code == 200, fac.text
    facilities = fac.json()
    facility_id = facilities[0]["id"] if facilities else None

    created_def = await client.post(
        "/api/v1/pulse/schedule/shift-definitions",
        headers=headers,
        json={
            "code": "D2T",
            "name": "Day with P1",
            "start_min": 480,
            "end_min": 960,
            "shift_type": "day",
            "cert_requirements": ["P1"],
        },
    )
    assert created_def.status_code == 201, created_def.text
    defn = created_def.json()
    assert defn["cert_requirements"] == ["P1"]

    starts = "2026-09-15T15:00:00Z"
    ends = "2026-09-15T23:00:00Z"
    payload = {
        "assigned_user_id": seeded_tenant.worker_id,
        "starts_at": starts,
        "ends_at": ends,
        "shift_type": "day",
        "shift_definition_id": defn["id"],
        "shift_code": "D2T",
    }
    if facility_id:
        payload["facility_id"] = facility_id

    created = await client.post("/api/v1/pulse/schedule/shifts", headers=headers, json=payload)
    assert created.status_code == 200, created.text
    body = created.json()
    shift = body["shift"]
    assert shift["required_certifications"] == ["P1"]
    codes = {a["code"] for a in shift["staffing_alarms"]}
    assert "training_missing" in codes
    assert any("Pool Operator" in w or "P1" in w for w in body["warnings"])

    listed = await client.get(
        "/api/v1/pulse/schedule/shifts?from=2026-09-15T00:00:00Z&to=2026-09-16T00:00:00Z",
        headers=headers,
    )
    assert listed.status_code == 200, listed.text
    found = next((row for row in listed.json() if row["id"] == shift["id"]), None)
    assert found is not None
    assert any(a["code"] == "training_missing" for a in found["staffing_alarms"])

    patched = await client.patch(
        f"/api/v1/pulse/workers/{seeded_tenant.worker_id}/profile",
        headers=headers,
        json={"certifications": ["P1"]},
    )
    assert patched.status_code == 200, patched.text

    got = await client.get(f"/api/v1/pulse/schedule/shifts/{shift['id']}", headers=headers)
    assert got.status_code == 200, got.text
    assert got.json()["staffing_alarms"] == []
    assert got.json()["required_certifications"] == ["P1"]


@pytest.mark.asyncio
async def test_expired_cert_is_alarm_not_http_error(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    headers = auth_headers(seeded_tenant.manager_token)
    cid = seeded_tenant.company_id
    db_session.add(
        PulseWorkerCertification(
            user_id=seeded_tenant.worker_id,
            company_id=cid,
            name="P1",
            expiry_date=datetime.now(timezone.utc) - timedelta(days=3),
        )
    )
    await db_session.commit()

    created_def = await client.post(
        "/api/v1/pulse/schedule/shift-definitions",
        headers=headers,
        json={
            "code": "D2E",
            "name": "Day expired P1",
            "start_min": 480,
            "end_min": 960,
            "shift_type": "day",
            "cert_requirements": ["P1"],
        },
    )
    assert created_def.status_code == 201, created_def.text

    created = await client.post(
        "/api/v1/pulse/schedule/shifts",
        headers=headers,
        json={
            "assigned_user_id": seeded_tenant.worker_id,
            "starts_at": "2026-10-01T15:00:00Z",
            "ends_at": "2026-10-01T23:00:00Z",
            "shift_type": "day",
            "shift_definition_id": created_def.json()["id"],
        },
    )
    assert created.status_code == 200, created.text
    alarms = created.json()["shift"]["staffing_alarms"]
    assert any(a["code"] == "training_expired" for a in alarms)
