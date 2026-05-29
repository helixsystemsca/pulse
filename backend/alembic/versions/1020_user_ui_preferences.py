"""Per-user UI preferences (dashboard layouts, etc.)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1020_user_ui_preferences"
down_revision = "1019_assignment_handovers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "users",
        sa.Column("ui_preferences", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "users", "ui_preferences")
