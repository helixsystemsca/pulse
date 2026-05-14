"""
Re-export Alembic introspection helpers for ``from app.db.alembic_helpers import ...``.

The canonical implementation lives at the backend root: ``alembic_helpers.py`` (Alembic
revision scripts historically add the backend directory to ``sys.path`` and import that module).
"""

from __future__ import annotations

import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parents[2]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from alembic_helpers import (  # noqa: E402
    column_default_text,
    column_exists,
    column_has_nonnull_default,
    constraint_exists,
    index_exists,
    is_greenfield_from_metadata,
    log_migration_sql,
    logged_execute,
    safe_add_column,
    safe_alter_column,
    safe_alter_column_drop_server_default,
    safe_create_check_constraint,
    safe_create_foreign_key,
    safe_create_index,
    safe_create_table,
    safe_create_unique_constraint,
    safe_drop_column,
    safe_drop_constraint,
    safe_drop_index,
    safe_drop_table,
    table_exists,
)

__all__ = [
    "column_default_text",
    "column_exists",
    "column_has_nonnull_default",
    "constraint_exists",
    "index_exists",
    "is_greenfield_from_metadata",
    "log_migration_sql",
    "logged_execute",
    "safe_add_column",
    "safe_alter_column",
    "safe_alter_column_drop_server_default",
    "safe_create_check_constraint",
    "safe_create_foreign_key",
    "safe_create_index",
    "safe_create_table",
    "safe_create_unique_constraint",
    "safe_drop_column",
    "safe_drop_constraint",
    "safe_drop_index",
    "safe_drop_table",
    "table_exists",
]
