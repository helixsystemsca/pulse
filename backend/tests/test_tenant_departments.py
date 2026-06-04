"""Tenant departments API."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_tenant_departments_seeded_tenant(seeded_tenant) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/workers/tenant-departments",
            headers={
                **auth_headers(seeded_tenant.manager_token),
                "Origin": "https://ops.helixsystems.ca",
            },
        )
    assert res.status_code == 200, res.text
    assert res.headers.get("access-control-allow-origin") == "https://ops.helixsystems.ca"
    body = res.json()
    assert isinstance(body.get("items"), list)
    # Departments are tenant-configured only; no default seed on list.
    assert body["items"] == []


@pytest.mark.asyncio
async def test_tenant_roles_not_routed_as_worker_user_id(seeded_tenant) -> None:
    """Regression: `/workers/tenant-roles` must not match `/workers/{user_id}`."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/workers/tenant-roles",
            headers=auth_headers(seeded_tenant.manager_token),
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert "items" in body
    assert "catalog_feature_keys" in body
