"""Procedure training matrix, compliance settings, sign-off, acknowledgement."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

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


@pytest.mark.asyncio
async def test_training_matrix_forbidden_for_worker(client, seeded_tenant) -> None:
    r = await client.get("/api/v1/training/matrix", headers=auth_headers(seeded_tenant.worker_token))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_training_matrix_allowed_for_lead(client, seeded_tenant, db_session: AsyncSession) -> None:
    from app.core.auth.security import create_access_token, hash_password
    from app.models.domain import User, UserRole

    lead_id = str(uuid.uuid4())
    suffix = uuid.uuid4().hex[:8]
    lead = User(
        id=lead_id,
        company_id=seeded_tenant.company_id,
        email=f"lead_{suffix}@pytest.test",
        hashed_password=hash_password(seeded_tenant.password),
        full_name="Pytest Lead",
        roles=[UserRole.lead.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
    )
    db_session.add(lead)
    await db_session.commit()

    token = create_access_token(
        subject=lead_id,
        extra_claims={"company_id": seeded_tenant.company_id, "role": UserRole.lead.value},
    )
    r = await client.get("/api/v1/training/matrix", headers=auth_headers(token))
    assert r.status_code == 200, r.text
