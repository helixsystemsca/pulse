"""Equipment roster accounts on Team Management (scanner kiosk login)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.auth.security import create_access_token, hash_password, verify_password
from app.core.equipment_roster import EQUIPMENT_ROSTER_DEPARTMENT
from app.core.features.service import sync_enabled_features
from app.core.tenant_roles import assign_user_tenant_role, create_or_fetch_tenant_role
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_equipment_account_listed_and_password_set(client, db_session, seeded_tenant) -> None:
    cid = seeded_tenant.company_id
    await sync_enabled_features(db_session, cid, ["inventory", "inventory_scanner"])

    admin_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    admin = User(
        id=admin_id,
        company_id=cid,
        email="admin-equipment@example.com",
        hashed_password=hash_password("pytest-pass-12345"),
        full_name="Equipment Admin",
        roles=[UserRole.company_admin.value],
        is_active=True,
    )
    scanner_id = "dddddddd-dddd-dddd-dddd-dddddddddddd"
    role = await create_or_fetch_tenant_role(
        db_session,
        cid,
        slug="inventory_scanner",
        name="Inventory Scanner",
        feature_keys=["inventory_scanner"],
    )
    scanner = User(
        id=scanner_id,
        company_id=cid,
        email="scanner@panorama.ca",
        hashed_password=hash_password("Old-Scanner-Pass1!"),
        full_name="Inventory Scanner",
        roles=[UserRole.worker.value],
        is_active=True,
        feature_allow_extra=["inventory_scanner"],
        rbac_permission_extra=["inventory.scan"],
    )
    db_session.add_all([admin, scanner])
    await db_session.flush()
    await assign_user_tenant_role(db_session, scanner, role)
    db_session.add(
        PulseWorkerHR(
            user_id=scanner_id,
            company_id=cid,
            department=EQUIPMENT_ROSTER_DEPARTMENT,
            job_title="Inventory Scanner",
        )
    )
    await db_session.commit()

    admin_token = create_access_token(
        subject=admin_id,
        extra_claims={"company_id": cid, "role": UserRole.company_admin.value, "tv": 0},
    )
    headers = auth_headers(admin_token)

    listed = await client.get("/api/workers", headers=headers)
    assert listed.status_code == 200
    rows = listed.json()["items"]
    scanner_row = next(r for r in rows if r["email"] == "scanner@panorama.ca")
    assert scanner_row["is_equipment_account"] is True
    assert scanner_row["department"] == "equipment"

    bad = await client.post(
        f"/api/workers/{seeded_tenant.worker_id}/set-password",
        headers=headers,
        json={"new_password": "New-Worker-Pass2!"},
    )
    assert bad.status_code == 400

    ok = await client.post(
        f"/api/workers/{scanner_id}/set-password",
        headers=headers,
        json={"new_password": "New-Scanner-Pass2!"},
    )
    assert ok.status_code == 204

    row = (
        await db_session.execute(select(User).where(User.id == scanner_id))
    ).scalar_one()
    assert verify_password("New-Scanner-Pass2!", row.hashed_password)
