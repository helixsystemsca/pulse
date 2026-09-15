"""PM-coord gating must match `/auth/me` `can_use_pm_features` (DB flag or RBAC)."""

from __future__ import annotations

import uuid

import pytest

from app.core.auth.security import create_access_token, hash_password
from app.models.domain import User, UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_pm_coord_allows_company_admin_without_db_flag(client, seeded_tenant, db_session) -> None:
    cid = seeded_tenant.company_id
    admin_id = str(uuid.uuid4())
    admin = User(
        id=admin_id,
        company_id=cid,
        email=f"pmadmin_{admin_id[:8]}@vernon.example",
        hashed_password=hash_password("pytest-pass-12345"),
        full_name="PM Admin",
        roles=[UserRole.company_admin.value],
        is_active=True,
        can_use_pm_features=False,
        is_system_admin=False,
    )
    db_session.add(admin)
    await db_session.flush()
    token = create_access_token(
        subject=admin_id,
        extra_claims={"company_id": cid, "role": UserRole.company_admin.value, "tv": 0},
    )
    headers = auth_headers(token)

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["can_use_pm_features"] is True

    res = await client.get("/api/v1/pm-coord/projects", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == []


@pytest.mark.asyncio
async def test_pm_coord_denies_worker_without_flag(client, seeded_tenant, db_session) -> None:
    from app.models.domain import User
    from tests.tenant_role_helpers import assign_worker_no_access_role

    worker = await db_session.get(User, seeded_tenant.worker_id)
    assert worker is not None
    worker.can_use_pm_features = False
    await assign_worker_no_access_role(
        db_session,
        company_id=seeded_tenant.company_id,
        user=worker,
    )
    await db_session.flush()

    headers = auth_headers(seeded_tenant.worker_token)
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["can_use_pm_features"] is False

    res = await client.get("/api/v1/pm-coord/projects", headers=headers)
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "pm_features_disabled"
