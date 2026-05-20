"""Widen alembic_version.version_num to VARCHAR(128) for revision id headroom."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1015_version_num_128"
down_revision = "1014_idea_approvals"
branch_labels = None
depends_on = None

_VERSION_NUM_WIDTH = 128


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "alembic_version"):
        op.execute(
            sa.text(f"ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR({_VERSION_NUM_WIDTH})")
        )


def downgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "alembic_version"):
        return
    op.execute(sa.text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(32)"))
