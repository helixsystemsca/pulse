"""Roadmap placeholder projects — quick-add without full project setup."""

from __future__ import annotations

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

revision = "1046_project_roadmap_stub"
down_revision = "1045_roadmap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column("roadmap_stub", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "pulse_projects", "roadmap_stub")
