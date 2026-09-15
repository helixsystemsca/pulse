"""Production schedule APIs must not return hard-coded rink mock rows."""

from __future__ import annotations

import pytest

from app.services.xplor_client import XplorClient
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_get_schedules_with_fallback_empty_when_mock_disabled() -> None:
    client = XplorClient(use_mock_data=False, api_key="")
    raw = await client.get_schedules_with_fallback()
    assert raw == {"schedules": []}


@pytest.mark.asyncio
async def test_get_schedules_with_fallback_mock_ids_only_when_enabled() -> None:
    client = XplorClient(use_mock_data=True, api_key="")
    raw = await client.get_schedules_with_fallback()
    ids = [row["id"] for row in raw.get("schedules", [])]
    assert ids == ["mock-1", "mock-2", "mock-3"]


@pytest.mark.asyncio
async def test_schedule_http_has_no_mock_rows(client, seeded_tenant) -> None:
    res = await client.get("/api/schedule", headers=auth_headers(seeded_tenant.manager_token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert isinstance(body, list)
    assert all(not str(item.get("id", "")).startswith("mock-") for item in body)

    live = await client.get("/api/schedule/live", headers=auth_headers(seeded_tenant.manager_token))
    assert live.status_code == 200, live.text
    live_body = live.json()
    assert live_body.get("events") == []
    assert "Not implemented yet." not in str(live_body.get("message", ""))
