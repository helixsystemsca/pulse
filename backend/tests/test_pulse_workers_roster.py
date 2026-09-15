"""Pulse workers / dashboard must include tenant roster users, including company admins without operational_role."""

from __future__ import annotations

import uuid

import pytest

from app.core.auth.security import create_access_token, hash_password
from app.models.domain import User, UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_pulse_workers_include_company_admin_without_operational_role(
    client, seeded_tenant, db_session
) -> None:
    cid = seeded_tenant.company_id
    admin_id = str(uuid.uuid4())
    admin = User(
        id=admin_id,
        company_id=cid,
        email=f"admin_{admin_id[:8]}@vernon.example",
        hashed_password=hash_password("pytest-pass-12345"),
        full_name="City Admin",
        roles=[UserRole.company_admin.value],
        operational_role=None,
        is_active=True,
        is_system_admin=False,
    )
    db_session.add(admin)
    await db_session.flush()
    token = create_access_token(
        subject=admin_id,
        extra_claims={"company_id": cid, "role": UserRole.company_admin.value, "tv": 0},
    )
    headers = auth_headers(token)

    ops = await client.get("/api/workers", headers=headers)
    assert ops.status_code == 200, ops.text
    ops_ids = {row["id"] for row in ops.json()["items"]}
    assert admin_id in ops_ids

    pulse = await client.get("/api/v1/pulse/workers", headers=headers)
    assert pulse.status_code == 200, pulse.text
    pulse_ids = {row["id"] for row in pulse.json()}
    assert admin_id in pulse_ids
    assert seeded_tenant.worker_id in pulse_ids

    dash = await client.get("/api/v1/pulse/dashboard", headers=headers)
    assert dash.status_code == 200, dash.text
    assert dash.json()["active_workers"] >= 3
