"""Introspection for idempotent Alembic revisions (0001 uses metadata.create_all)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


def table_exists(conn: Connection, name: str) -> bool:
    r = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :n LIMIT 1"
        ),
        {"n": name},
    )
    return r.first() is not None


def column_exists(conn: Connection, table: str, column: str) -> bool:
    r = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c LIMIT 1"
        ),
        {"t": table, "c": column},
    )
    return r.first() is not None


def is_greenfield_from_metadata(conn: Connection) -> bool:
    """Schema produced by 0001 create_all (companies present, never had legacy tenants table)."""
    return table_exists(conn, "companies") and not table_exists(conn, "tenants")
