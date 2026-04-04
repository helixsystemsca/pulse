"""Authentication: login JWT and protected routes."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_login_returns_jwt(client, seeded_tenant) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": seeded_tenant.worker_email, "password": seeded_tenant.password},
    )
    assert r.status_code == 200, f"PIPELINE: auth — {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"
    assert len(data["access_token"]) > 20


@pytest.mark.asyncio
async def test_protected_route_rejects_without_token(client) -> None:
    r = await client.get("/api/work-requests")
    assert r.status_code == 401, f"PIPELINE: auth — expected 401, got {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_protected_route_accepts_valid_token(client, seeded_tenant) -> None:
    r = await client.get(
        "/api/work-requests",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 200, f"PIPELINE: auth — {r.status_code} {r.text}"
    body = r.json()
    assert "items" in body
    assert "total" in body
