"""
Deploy-safe Alembic entrypoint for alpha baseline consolidation.

Production databases may still record a pre-baseline revision (e.g.
``0128_rbac_audit_events``) in ``alembic_version``. Those scripts live in
``alembic/archive/`` and are not loaded. This script stamps ``1000_alpha_baseline``
when the stored revision is absent from the active tree, then runs ``upgrade head``.

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
ALPHA_BASELINE = "1000_alpha_baseline"

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
    return str(row[0]) if row and row[0] is not None else None


def _revision_in_active_tree(script: ScriptDirectory, revision: str) -> bool:
    try:
        script.get_revision(revision)
        return True
    except CommandError:
        return False


def _realign_orphan_revision(cfg: Config, script: ScriptDirectory, stored: str) -> bool:
    """Stamp baseline when DB points at an archived / unknown revision. Returns True if stamped."""
    if stored == ALPHA_BASELINE:
        return False
    if _revision_in_active_tree(script, stored):
        return False
    _log.warning(
        "alembic_version=%r is not in the active migration tree; stamping %s "
        "(schema must already match current ORM — alpha consolidation)",
        stored,
        ALPHA_BASELINE,
    )
    command.stamp(cfg, ALPHA_BASELINE)
    return True


def main() -> int:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    if heads != [ALPHA_BASELINE]:
        _log.error("expected single head %s, got %s", ALPHA_BASELINE, heads)
        return 1

    url = _sync_database_url()
    engine = create_engine(url)
    with engine.connect() as conn:
        stored = _read_stored_revision(conn)

    if stored is not None:
        _realign_orphan_revision(cfg, script, stored)

    _log.info("running alembic upgrade head")
    command.upgrade(cfg, "head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
