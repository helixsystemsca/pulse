"""CORS headers on API error responses (browser must see Access-Control-Allow-Origin)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

PANORAMA_ORIGIN = "https://panorama.helixsystems.ca"


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


def test_unauthenticated_get_still_returns_cors_headers() -> None:
    client = TestClient(app)
    res = client.get(
        "/api/v1/routines/assignments/day?date=2026-05-18",
        headers={"Origin": PANORAMA_ORIGIN},
    )
    assert res.status_code in (401, 403, 422)
    assert res.headers.get("access-control-allow-origin") == PANORAMA_ORIGIN
