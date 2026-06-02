"""CORS headers on API error responses (browser must see Access-Control-Allow-Origin)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import _validation_errors_for_json, app
from tests.conftest import auth_headers

PANORAMA_ORIGIN = "https://panorama.helixsystems.ca"
OPS_ORIGIN = "https://ops.helixsystems.ca"


def test_options_preflight_includes_ops_origin() -> None:
    client = TestClient(app)
    res = client.options(
        "/api/workers/tenant-departments",
        headers={
            "Origin": OPS_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == OPS_ORIGIN


def test_options_preflight_includes_panorama_origin() -> None:
    client = TestClient(app)
    res = client.options(
        "/api/v1/routines/assignments/day",
        headers={
            "Origin": PANORAMA_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == PANORAMA_ORIGIN


def test_validation_error_ctx_serializes_to_json() -> None:
    """Regression: ValueError in Pydantic ctx must not break 422 JSON (CI test_extreme_numeric)."""
    errors = [
        {
            "type": "value_error",
            "loc": ("body", "readings", 0, "value_num"),
            "msg": "Value error, value_num exceeds allowed range",
            "input": "1e40",
            "ctx": {"error": ValueError("value_num exceeds allowed range for sensor readings")},
        }
    ]
    payload = {"detail": _validation_errors_for_json(errors)}
    text = json.dumps(payload)
    assert "value_num exceeds allowed range" in text
    assert "1e40" in text


def test_unauthenticated_get_still_returns_cors_headers() -> None:
    client = TestClient(app)
    res = client.get(
        "/api/v1/routines/assignments/day?date=2026-05-18",
        headers={"Origin": PANORAMA_ORIGIN},
    )
    assert res.status_code in (401, 403, 422)
    assert res.headers.get("access-control-allow-origin") == PANORAMA_ORIGIN


@pytest.mark.asyncio
async def test_authenticated_assignments_day_does_not_500(seeded_tenant) -> None:
    """Regression: query param `date` must not shadow `datetime.date` (was AttributeError → opaque browser CORS)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/v1/routines/assignments/day?date=2026-05-18",
            headers={
                **auth_headers(seeded_tenant.manager_token),
                "Origin": PANORAMA_ORIGIN,
            },
        )
    assert res.status_code == 200, res.text
    assert res.headers.get("access-control-allow-origin") == PANORAMA_ORIGIN
    assert isinstance(res.json(), list)
