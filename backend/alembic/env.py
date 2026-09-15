"""Alembic migration environment (sync URL derived from app settings for `upgrade head`)."""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

_ALEMBIC_DIR = Path(__file__).resolve().parent
if str(_ALEMBIC_DIR) not in sys.path:
    sys.path.insert(0, str(_ALEMBIC_DIR))
from version_table import ensure_version_num_width, repair_stored_revision_if_alias  # noqa: E402

import alembic_helpers as ah  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.models import Base  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url() -> str:
    settings = get_settings()
    url, _source = ah.resolve_alembic_sync_url(
        settings.database_url,
        migration_url=settings.migration_database_url,
    )
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _sync_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        ensure_version_num_width(connection)
        repair_stored_revision_if_alias(connection)
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transaction_per_migration=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        # SQLAlchemy 2: begin_transaction() may not commit the connection-level
        # transaction; without this, all DDL is rolled back on context exit (CI
        # saw table_exists skips during upgrade but zero tables afterward).
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
