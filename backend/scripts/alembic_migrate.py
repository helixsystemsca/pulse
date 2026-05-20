"""
Deploy-safe Alembic entrypoint for alpha baseline consolidation.

Production databases may still record a pre-baseline revision (e.g.
``0128_rbac_audit_events``) in ``alembic_version``. Those scripts live in
``alembic/archive/`` and are not loaded. This script updates ``alembic_version``
directly when the stored revision is absent from the active tree (bypassing
``command.stamp``, which would fail revision resolution), then runs
``upgrade head``.

Usage (Render / production):
    python scripts/alembic_migrate.py

Requires ``DATABASE_URL`` (sync ``postgresql+psycopg`` or ``postgresql``).
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT / "alembic"))
from version_table import (  # noqa: E402
    ensure_version_num_width,
    normalize_stored_revision,
    repair_stored_revision_if_alias,
)
ALPHA_BASELINE = "1000_alpha_baseline"
_REQUIRED_PUBLIC_TABLES: tuple[str, ...] = (
    "rbac_catalog_permissions",
    "tenant_roles",
    "tenant_role_grants",
    "companies",
    "users",
)

_log = logging.getLogger("alembic.migrate")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def _sync_database_url() -> str:
    sys.path.insert(0, str(BACKEND_ROOT))
    from app.core.config import get_settings

    url = get_settings().database_url.strip()
    if "+asyncpg" in url:
        return url.replace("postgresql+asyncpg", "postgresql+psycopg", 1)
    return url


def _read_stored_revision(conn) -> str | None:
    if "alembic_version" not in inspect(conn).get_table_names():
        return None
    row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
    if not row or row[0] is None:
        return None
    return normalize_stored_revision(str(row[0]))


def _revision_in_active_tree(script: ScriptDirectory, revision: str) -> bool:
    try:
        script.get_revision(revision)
        return True
    except CommandError:
        return False


def _direct_realign_orphan_revision(conn, stored: str) -> None:
    """
    Rewrite alembic_version without Alembic stamp (stamp resolves the old revision first and fails).
    """
    _log.warning(
        "detected orphan revision: %r (not in active migration tree; archived consolidation)",
        stored,
    )
    result = conn.execute(
        text("UPDATE alembic_version SET version_num = :baseline"),
        {"baseline": ALPHA_BASELINE},
    )
    conn.commit()
    _log.info(
        "direct repair applied: updated %s row(s) in alembic_version -> %r",
        result.rowcount,
        ALPHA_BASELINE,
    )
    _log.info("baseline realignment complete")


def _require_single_head(script: ScriptDirectory) -> str:
    """Return the sole active revision id; fail if the tree has zero or multiple heads."""
    heads = script.get_heads()
    if len(heads) != 1:
        _log.error("expected exactly one migration head, got %s", heads)
        raise SystemExit(1)
    head = heads[0]
    _log.info("active migration head: %r", head)
    return head


def main() -> int:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    migration_head = _require_single_head(script)

    url = _sync_database_url()
    engine = create_engine(url)
    with engine.connect() as conn:
        ensure_version_num_width(conn)
        repair_stored_revision_if_alias(conn)
        stored = _read_stored_revision(conn)
        if stored is not None:
            if stored == migration_head:
                _log.info("alembic_version already at head %r", migration_head)
            elif stored == ALPHA_BASELINE or _revision_in_active_tree(script, stored):
                _log.info("alembic_version=%r; proceeding with upgrade head", stored)
            else:
                _direct_realign_orphan_revision(conn, stored)

    _log.info("STARTUP: running alembic upgrade head")
    command.upgrade(cfg, "head")
    _log.info("STARTUP: alembic upgrade head complete")

    with engine.connect() as conn:
        public_tables = set(inspect(conn).get_table_names(schema="public"))
    missing = [t for t in _REQUIRED_PUBLIC_TABLES if t not in public_tables]
    if missing:
        _log.error(
            "schema incomplete after upgrade head (database=%r); missing tables: %s",
            url.split("@")[-1] if "@" in url else url,
            ", ".join(missing),
        )
        raise SystemExit(1)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
