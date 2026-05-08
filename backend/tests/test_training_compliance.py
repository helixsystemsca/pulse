"""Procedure training matrix, compliance settings, sign-off, acknowledgement."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_training_assign_signoff_matrix_and_profile(client, seeded_tenant) -> None:
    mgr_headers = auth_headers(seeded_tenant.manager_token)
    worker_headers = auth_headers(seeded_tenant.worker_token)
    wid = seeded_tenant.worker_id

    proc = await client.post(
        "/api/v1/cmms/procedures",
        headers=mgr_headers,
        json={
            "title": "Lockout / tagout drill",
            "steps": [
                {"id": "s1", "type": "instruction", "content": "Verify zero energy state.", "required": True},
            ],
        },
    )
    assert proc.status_code == 201, proc.text
    pid = proc.json()["id"]

    comp = await client.patch(
        f"/api/v1/cmms/procedures/{pid}/compliance",
        headers=mgr_headers,
        json={"tier": "mandatory", "due_within_days": 7, "requires_acknowledgement": True},
    )
    assert comp.status_code == 200, comp.text

    assign = await client.post(
        "/api/v1/training/assignments",
        headers=mgr_headers,
        json={"procedure_id": pid, "employee_user_ids": [wid]},
    )
    assert assign.status_code == 200, assign.text

    so = await client.post(
        f"/api/v1/cmms/procedures/{pid}/sign-off",
        headers=worker_headers,
        json={},
    )
    assert so.status_code == 200, so.text

    ack = await client.post(
        f"/api/v1/cmms/procedures/{pid}/acknowledgement",
        headers=worker_headers,
        json={},
    )
    assert ack.status_code == 200, ack.text

    matrix = await client.get("/api/v1/training/matrix", headers=mgr_headers)
    assert matrix.status_code == 200, matrix.text
    mbody = matrix.json()
    statuses = [
        a["status"] for a in mbody["assignments"] if a["training_program_id"] == pid and a["employee_id"] == wid
    ]
    assert "completed" in statuses

    prof = await client.get(f"/api/workers/{wid}/training", headers=worker_headers)
    assert prof.status_code == 200, prof.text


@pytest.mark.asyncio
async def test_procedure_revision_requires_reacknowledgement(client, seeded_tenant) -> None:
    mgr_headers = auth_headers(seeded_tenant.manager_token)
    worker_headers = auth_headers(seeded_tenant.worker_token)
    wid = seeded_tenant.worker_id

    proc = await client.post(
        "/api/v1/cmms/procedures",
        headers=mgr_headers,
        json={
            "title": "Hydraulic bleed",
            "steps": [{"id": "s1", "type": "instruction", "content": "Open relief slowly.", "required": True}],
        },
    )
    assert proc.status_code == 201, proc.text
    pid = proc.json()["id"]

    await client.patch(
        f"/api/v1/cmms/procedures/{pid}/compliance",
        headers=mgr_headers,
        json={"tier": "general", "due_within_days": None, "requires_acknowledgement": True},
    )
    await client.post(
        "/api/v1/training/assignments",
        headers=mgr_headers,
        json={"procedure_id": pid, "employee_user_ids": [wid]},
    )
    await client.post(f"/api/v1/cmms/procedures/{pid}/sign-off", headers=worker_headers, json={})
    await client.post(f"/api/v1/cmms/procedures/{pid}/acknowledgement", headers=worker_headers, json={})

    upd = await client.patch(
        f"/api/v1/cmms/procedures/{pid}",
        headers=mgr_headers,
        json={"title": "Hydraulic bleed (rev 2)"},
    )
    assert upd.status_code == 200, upd.text

    matrix = await client.get("/api/v1/training/matrix", headers=mgr_headers)
    assert matrix.status_code == 200, matrix.text
    statuses = [
        a["status"]
        for a in matrix.json()["assignments"]
        if a["training_program_id"] == pid and a["employee_id"] == wid
    ]
    assert "revision_pending" in statuses

    await client.post(f"/api/v1/cmms/procedures/{pid}/acknowledgement", headers=worker_headers, json={})

    matrix2 = await client.get("/api/v1/training/matrix", headers=mgr_headers)
    statuses2 = [
        a["status"]
        for a in matrix2.json()["assignments"]
        if a["training_program_id"] == pid and a["employee_id"] == wid
    ]
    assert "completed" in statuses2
