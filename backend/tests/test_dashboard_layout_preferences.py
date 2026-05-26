"""Per-user dashboard layout persistence."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import TenantSeed


@pytest.mark.asyncio
async def test_dashboard_layout_round_trip(client: AsyncClient, seeded_tenant: TenantSeed) -> None:
    headers = {"Authorization": f"Bearer {seeded_tenant.manager_token}"}
    payload = {
        "version": 11,
        "layout": {
            "left": [{"id": "co2_monitoring", "heightTier": "compact"}],
            "hero": [{"id": "workforce", "heightTier": "expanded"}],
            "right": [],
        },
        "customWidgets": {"cw_demo": {"pageId": "overview", "title": "Peek"}},
    }

    put = await client.put(
        "/api/v1/profile/dashboard-layouts/operations",
        headers=headers,
        json=payload,
    )
    assert put.status_code == 200

    got = await client.get("/api/v1/profile/dashboard-layouts/operations", headers=headers)
    assert got.status_code == 200
    body = got.json()
    assert body is not None
    assert body["version"] == 11
    assert body["layout"]["hero"][0]["id"] == "workforce"
    assert body["customWidgets"]["cw_demo"]["title"] == "Peek"

    empty = await client.get("/api/v1/profile/dashboard-layouts/admin", headers=headers)
    assert empty.status_code == 200
    assert empty.json() is None
