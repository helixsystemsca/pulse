"""CORS allow-list construction (avatar and API calls from the Pulse SPA)."""

from __future__ import annotations

import pytest

from app.core.config import Settings, STANDARD_LOCAL_DEV_ORIGINS, _DEFAULT_PRODUCTION_FRONTEND_ORIGIN, get_settings


def test_production_always_allows_panorama_even_if_pulse_url_is_api_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("PULSE_APP_PUBLIC_URL", "https://pulse-wssd.onrender.com")
    get_settings.cache_clear()
    try:
        s = Settings()
        origins = s.cors_origin_list
        assert _DEFAULT_PRODUCTION_FRONTEND_ORIGIN in origins
        assert "https://pulse-wssd.onrender.com" in origins
        assert "http://localhost:3000" in origins
        assert "http://localhost:5173" in origins
    finally:
        get_settings.cache_clear()


def test_wildcard_origin_tokens_are_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("CORS_ORIGINS", "*,http://localhost:9999")
    get_settings.cache_clear()
    try:
        s = Settings()
        origins = s.cors_origin_list
        assert "*" not in origins
        assert "https://*" not in origins
        assert "http://localhost:9999" in origins
        for o in STANDARD_LOCAL_DEV_ORIGINS:
            assert o in origins
    finally:
        get_settings.cache_clear()


def test_development_merges_localhost_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    get_settings.cache_clear()
    try:
        s = Settings()
        origins = s.cors_origin_list
        for o in STANDARD_LOCAL_DEV_ORIGINS:
            assert o in origins
    finally:
        get_settings.cache_clear()