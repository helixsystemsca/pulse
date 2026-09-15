"""Create a facility, link inventory/assets, and list what the facility contains."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.core.features.cache import clear_all
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.models.domain import User, UserRole
from app.repositories.inventory_scope_repository import ensure_scope_for_company_slug


async def _admin_headers(db_session: AsyncSession, seeded_tenant) -> dict[str, str]:
    from app.core.company_features import sync_enabled_features

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    clear_all()
    token = create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_facility_link_inventory_asset_and_list_contents(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    headers = await _admin_headers(db_session, seeded_tenant)
    await ensure_scope_for_company_slug(db_session, seeded_tenant.company_id, "maintenance")
    await db_session.commit()

    created = await client.post(
        "/api/v1/recreation-ops/facilities",
        headers=headers,
        json={"title": "Civic Arena", "status": "active", "description": "Main ice"},
    )
    assert created.status_code == 201, created.text
    facility = created.json()
    fid = facility["id"]
    assert facility["title"] == "Civic Arena"

    listed = await client.get("/api/v1/recreation-ops/facilities", headers=headers)
    assert listed.status_code == 200, listed.text
    titles = [row["title"] for row in listed.json()]
    assert "Civic Arena" in titles
    assert all("seed" not in t.lower() for t in titles)

    asset = await client.post(
        "/api/v1/equipment",
        headers=headers,
        json={"name": "Ice plant", "type": "Mechanical / fluid", "ops_facility_id": fid},
    )
    assert asset.status_code == 201, asset.text
    asset_body = asset.json()
    assert asset_body["ops_facility_id"] == fid
    assert asset_body["ops_facility_name"] == "Civic Arena"

    child = await client.post(
        "/api/v1/equipment",
        headers=headers,
        json={
            "name": "Compressor A",
            "type": "Mechanical / fluid",
            "parent_equipment_id": asset_body["id"],
        },
    )
    assert child.status_code == 201, child.text
    child_body = child.json()
    assert child_body["parent_equipment_id"] == asset_body["id"]
    assert child_body["parent_equipment_name"] == "Ice plant"
    assert child_body["ops_facility_id"] == fid
    assert child_body["ops_facility_name"] == "Civic Arena"

    inv = await client.post(
        "/api/inventory",
        headers=headers,
        json={
            "name": "Ammonia detector tubes",
            "item_type": "part",
            "quantity": 4,
            "unit": "each",
            "ops_facility_id": fid,
            "department_slug": "maintenance",
        },
    )
    assert inv.status_code == 201, inv.text
    inv_body = inv.json()
    assert inv_body["ops_facility_id"] == fid
    assert inv_body["ops_facility_name"] == "Civic Arena"

    filtered_eq = await client.get(f"/api/v1/equipment?ops_facility_id={fid}", headers=headers)
    assert filtered_eq.status_code == 200, filtered_eq.text
    eq_names = {row["name"] for row in filtered_eq.json()}
    assert eq_names == {"Ice plant", "Compressor A"}

    filtered_inv = await client.get(f"/api/inventory?ops_facility_id={fid}", headers=headers)
    assert filtered_inv.status_code == 200, filtered_inv.text
    inv_names = {row["name"] for row in filtered_inv.json()["items"]}
    assert "Ammonia detector tubes" in inv_names

    by_eq_q = await client.get("/api/v1/equipment?q=arena", headers=headers)
    assert by_eq_q.status_code == 200, by_eq_q.text
    assert "Ice plant" in {row["name"] for row in by_eq_q.json()}

    by_inv_q = await client.get("/api/inventory?q=arena", headers=headers)
    assert by_inv_q.status_code == 200, by_inv_q.text
    assert "Ammonia detector tubes" in {row["name"] for row in by_inv_q.json()["items"]}

    contents = await client.get(
        f"/api/v1/recreation-ops/facilities/{fid}/contents",
        headers=headers,
    )
    assert contents.status_code == 200, contents.text
    payload = contents.json()
    assert payload["facility"]["title"] == "Civic Arena"
    asset_names = {row["name"] for row in payload["assets"]}
    assert asset_names == {"Ice plant", "Compressor A"}
    compressor = next(row for row in payload["assets"] if row["name"] == "Compressor A")
    assert compressor["parent_equipment_name"] == "Ice plant"
    inv_names = {row["name"] for row in payload["inventory"]}
    assert "Ammonia detector tubes" in inv_names


@pytest.mark.asyncio
async def test_facility_picker_rejects_foreign_facility(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    headers = await _admin_headers(db_session, seeded_tenant)
    other = str(uuid.uuid4())
    created = await client.post(
        "/api/v1/equipment",
        headers=headers,
        json={"name": "Orphan pump", "ops_facility_id": other},
    )
    assert created.status_code == 400
    assert "facility" in created.json()["detail"].lower()
