"""Work requests (Issues) API — maps to mobile /web \"issues\"."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_get_issues_requires_auth(client) -> None:
    r = await client.get("/api/work-requests")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_issues_shape(client, seeded_tenant) -> None:
    r = await client.get("/api/work-requests", headers=auth_headers(seeded_tenant.worker_token))
    assert r.status_code == 200, f"PIPELINE: issues API — {r.text}"
    data = r.json()
    assert "items" in data and "total" in data
    for item in data["items"]:
        assert "id" in item
        assert "status" in item
        assert "priority" in item
        assert "created_at" in item
        assert "updated_at" in item


@pytest.mark.asyncio
async def test_post_issue_worker(client, seeded_tenant) -> None:
    r = await client.post(
        "/api/work-requests",
        json={
            "title": "Pytest field issue",
            "description": "Simulated from automated test",
            "priority": "medium",
            "category": "test",
        },
        headers={**auth_headers(seeded_tenant.worker_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 201, f"PIPELINE: issues API — {r.status_code} {r.text}"
    row = r.json()
    assert row["status"] == "open"
    assert row["title"] == "Pytest field issue"
    assert row["id"]


@pytest.mark.asyncio
async def test_patch_issue_status_manager(client, seeded_tenant) -> None:
    cr = await client.post(
        "/api/work-requests",
        json={"title": "To close", "priority": "low"},
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert cr.status_code == 201
    wr_id = cr.json()["id"]

    pr = await client.patch(
        f"/api/work-requests/{wr_id}",
        json={"status": "completed"},
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert pr.status_code == 200, f"PIPELINE: issues API — {pr.text}"
    assert pr.json()["status"] == "completed"
    assert pr.json().get("completed_at")


@pytest.mark.asyncio
async def test_patch_issue_invalid_body(client, seeded_tenant) -> None:
    cr = await client.post(
        "/api/work-requests",
        json={"title": "Bad patch target", "priority": "low"},
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert cr.status_code == 201
    wr_id = cr.json()["id"]
    r = await client.patch(
        f"/api/work-requests/{wr_id}",
        json={"priority": "not-a-real-priority"},
        headers={**auth_headers(seeded_tenant.manager_token), "Content-Type": "application/json"},
    )
    assert r.status_code == 422, f"PIPELINE: issues API — expected 422, got {r.status_code}"
