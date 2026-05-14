"""
PostgreSQL-safe introspection helpers for Alembic revisions.

**Rules**
- Prefer ``if not exists: DDL`` over ``try: DDL except: pass``. On PostgreSQL, a failed DDL
  aborts the current transaction; catching the exception in Python does **not** clear the
  aborted state, so later statements fail with ``InFailedSqlTransaction``.

**Schema ownership**
- ``0001_initial_schema`` uses ``Base.metadata.create_all``; later revisions must stay
  idempotent when the ORM already created indexes/columns (use helpers below).

Canonical import (from ``backend/`` on ``sys.path``): ``import alembic_helpers as ah``.
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

from sqlalchemy import text
from sqlalchemy.engine import Connection

_log = logging.getLogger("alembic.helpers")


def _skip(operation: str, **context: Any) -> None:
    """Log a skipped DDL helper step (``context`` may include table, column, cause, index, …)."""
    if context:
        _log.info("alembic_helpers skip operation=%s %s", operation, context)
    else:
        _log.info("alembic_helpers skip operation=%s", operation)


def skip(operation: str, **context: Any) -> None:
    """Public alias for :func:`_skip` — use in revisions for optional data/SQL steps."""
    _skip(operation, **context)


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


def index_exists(conn: Connection, index_name: str) -> bool:
    r = conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = :n LIMIT 1"),
        {"n": index_name},
    )
    return r.first() is not None


def constraint_exists(conn: Connection, constraint_name: str) -> bool:
    r = conn.execute(
        text("SELECT 1 FROM pg_constraint WHERE conname = :n LIMIT 1"),
        {"n": constraint_name},
    )
    return r.first() is not None


def column_default_text(conn: Connection, table: str, column: str) -> str | None:
    """``information_schema.columns.column_default`` (None if no default)."""
    r = conn.execute(
        text(
            "SELECT column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c LIMIT 1"
        ),
        {"t": table, "c": column},
    )
    row = r.first()
    if not row:
        return None
    v = row[0]
    return str(v) if v is not None else None


def column_has_nonnull_default(conn: Connection, table: str, column: str) -> bool:
    return column_default_text(conn, table, column) is not None


def safe_create_index(
    op: Any,
    conn: Connection,
    index_name: str,
    table_name: str,
    columns: Iterable[str],
    *,
    unique: bool = False,
    **kwargs: Any,
) -> None:
    if index_exists(conn, index_name):
        _skip("create_index", index=index_name, table=table_name, cause="index_exists")
        return
    op.create_index(index_name, table_name, list(columns), unique=unique, **kwargs)


def safe_drop_index(
    op: Any,
    conn: Connection,
    index_name: str,
    table_name: str,
    *,
    schema: str | None = None,
    **kw: Any,
) -> None:
    if not index_exists(conn, index_name):
        _skip("drop_index", index=index_name, table=table_name, cause="index_missing")
        return
    op.drop_index(index_name, table_name=table_name, schema=schema, **kw)


def safe_alter_column_drop_server_default(op: Any, conn: Connection, table: str, column: str) -> None:
    """Remove ``server_default`` only when one is present — avoids aborted transactions from no-op ALTERs."""
    if not column_exists(conn, table, column):
        _skip("alter_column_drop_server_default", table=table, column=column, cause="column_missing")
        return
    if not column_has_nonnull_default(conn, table, column):
        _skip("alter_column_drop_server_default", table=table, column=column, cause="no_default")
        return
    op.alter_column(table, column, server_default=None)


def safe_add_column(
    op: Any,
    conn: Connection,
    table_name: str,
    column: Any,
    *,
    schema: str | None = None,
) -> None:
    """``op.add_column`` only if the column name is not already present."""
    name = getattr(column, "name", None)
    if not name:
        raise ValueError("safe_add_column requires a sqlalchemy.schema.Column with .name")
    if column_exists(conn, table_name, str(name)):
        _skip("add_column", table=table_name, column=str(name), cause="column_exists")
        return
    op.add_column(table_name, column, schema=schema)


def safe_drop_column(op: Any, conn: Connection, table_name: str, column_name: str, *, schema: str | None = None) -> None:
    if not column_exists(conn, table_name, column_name):
        _skip("drop_column", table=table_name, column=column_name, cause="column_missing")
        return
    op.drop_column(table_name, column_name, schema=schema)


def safe_create_table(op: Any, conn: Connection, table_name: str, *args: Any, **kw: Any) -> None:
    if table_exists(conn, table_name):
        _skip("create_table", table=table_name, cause="table_exists")
        return
    op.create_table(table_name, *args, **kw)


def safe_drop_table(op: Any, conn: Connection, table_name: str, **kw: Any) -> None:
    if not table_exists(conn, table_name):
        _skip("drop_table", table=table_name, cause="table_missing")
        return
    op.drop_table(table_name, **kw)


def safe_drop_constraint(
    op: Any,
    conn: Connection,
    constraint_name: str,
    table_name: str,
    *,
    type_: str | None = None,
    schema: str | None = None,
) -> None:
    if not constraint_exists(conn, constraint_name):
        _skip("drop_constraint", constraint=constraint_name, table=table_name, cause="constraint_missing")
        return
    op.drop_constraint(constraint_name, table_name, type_=type_, schema=schema)


def safe_create_foreign_key(op: Any, conn: Connection, constraint_name: str, *args: Any, **kwargs: Any) -> None:
    if constraint_exists(conn, constraint_name):
        _skip("create_foreign_key", constraint=constraint_name, cause="constraint_exists")
        return
    op.create_foreign_key(constraint_name, *args, **kwargs)


def safe_create_unique_constraint(
    op: Any,
    conn: Connection,
    constraint_name: str,
    table_name: str,
    columns: Iterable[str],
    **kw: Any,
) -> None:
    if constraint_exists(conn, constraint_name):
        _skip("create_unique_constraint", constraint=constraint_name, table=table_name, cause="constraint_exists")
        return
    op.create_unique_constraint(constraint_name, table_name, list(columns), **kw)


def safe_create_check_constraint(
    op: Any,
    conn: Connection,
    constraint_name: str,
    table_name: str,
    condition: Any,
    **kw: Any,
) -> None:
    if constraint_exists(conn, constraint_name):
        _skip("create_check_constraint", constraint=constraint_name, table=table_name, cause="constraint_exists")
        return
    op.create_check_constraint(constraint_name, table_name, condition, **kw)


def safe_alter_column(op: Any, conn: Connection, table_name: str, column_name: str, **kw: Any) -> None:
    """``op.alter_column`` only if the column exists (avoids aborted transactions on missing columns)."""
    if not column_exists(conn, table_name, column_name):
        _skip("alter_column", table=table_name, column=column_name, cause="column_missing")
        return
    if kw == {"server_default": None}:
        if not column_has_nonnull_default(conn, table_name, column_name):
            _skip("alter_column", table=table_name, column=column_name, cause="no_default")
            return
    op.alter_column(table_name, column_name, **kw)


_MIGRATION_SQL_PREVIEW_LEN = 2000


def log_migration_sql(
    operation: str,
    *,
    revision: str | None = None,
    sql_preview: str | None = None,
    **extra: Any,
) -> None:
    """Log a single INFO line for raw SQL / data steps (pair with :func:`logged_execute`)."""
    bits: list[str] = [f"operation={operation}"]
    if revision is not None:
        bits.append(f"revision={revision}")
    if sql_preview is not None:
        s = sql_preview.replace("\n", " ").strip()
        if len(s) > _MIGRATION_SQL_PREVIEW_LEN:
            s = s[:_MIGRATION_SQL_PREVIEW_LEN] + "…(truncated)"
        bits.append(f"sql={s!r}")
    if extra:
        bits.append(f"extra={extra!r}")
    _log.info("alembic_helpers migration_sql %s", " ".join(bits))


def _sql_preview_from_executable(sql: Any) -> str | None:
    try:
        t = getattr(sql, "text", None)
        if t is not None:
            return str(t)
        return str(sql)
    except Exception:
        return None


def logged_execute(
    op: Any,
    sql: Any,
    *exec_args: Any,
    operation: str = "execute",
    revision: str | None = None,
    **exec_kwargs: Any,
) -> Any:
    """Run ``op.execute`` after logging SQL preview (use ``revision=__file__`` or module ``revision`` id)."""
    log_migration_sql(operation, revision=revision, sql_preview=_sql_preview_from_executable(sql))
    return op.execute(sql, *exec_args, **exec_kwargs)


def is_greenfield_from_metadata(conn: Connection) -> bool:
    """Schema produced by 0001 create_all (companies present, never had legacy tenants table)."""
    return table_exists(conn, "companies") and not table_exists(conn, "tenants")
