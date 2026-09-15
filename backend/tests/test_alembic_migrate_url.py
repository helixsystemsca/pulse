"""Alembic dual-URL resolution (runtime pulse_app vs owner migration URL)."""

from __future__ import annotations

import pytest

from alembic_helpers import resolve_alembic_sync_url
from app.core.config import Settings, get_settings


def test_resolve_prefers_migration_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "MIGRATION_DATABASE_URL",
        "postgresql+asyncpg://owner:secret@db/pulse",
    )
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://pulse_app:app@db/pulse")
    url, source = resolve_alembic_sync_url("postgresql+asyncpg://pulse_app:app@db/pulse")
    assert url == "postgresql+psycopg://owner:secret@db/pulse"
    assert source == "MIGRATION_DATABASE_URL"


def test_resolve_prefers_database_url_migrations_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    monkeypatch.setenv(
        "DATABASE_URL_MIGRATIONS",
        "postgresql://postgres:owner@db/pulse",
    )
    url, source = resolve_alembic_sync_url("postgresql+asyncpg://pulse_app:app@db/pulse")
    assert url == "postgresql://postgres:owner@db/pulse"
    assert source == "DATABASE_URL_MIGRATIONS"


def test_resolve_falls_back_to_runtime_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_MIGRATIONS", raising=False)
    url, source = resolve_alembic_sync_url(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/ops_intel"
    )
    assert url == "postgresql+psycopg://postgres:postgres@localhost:5432/ops_intel"
    assert source == "DATABASE_URL"


def test_settings_loads_migration_url_aliases(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIGRATION_DATABASE_URL", "postgresql+psycopg://owner:x@db/pulse")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://pulse_app:y@db/pulse")
    get_settings.cache_clear()
    try:
        s = Settings()
        assert s.database_url.startswith("postgresql+asyncpg://pulse_app:")
        assert s.migration_database_url.startswith("postgresql+psycopg://owner:")
    finally:
        get_settings.cache_clear()
