"""Project schedule overlay metadata (colors, staffing, blackout windows)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1007_project_schedule_overlay"
down_revision = "1006_user_rbac_permission_extra"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column("show_on_schedule", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column("overlay_color", sa.String(length=32), nullable=True),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column(
            "operational_impact_level",
            sa.String(length=16),
            nullable=False,
            server_default="medium",
        ),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column(
            "staffing_priority",
            sa.String(length=16),
            nullable=False,
            server_default="normal",
        ),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column("blackout_windows", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "pulse_projects", "blackout_windows")
    ah.safe_drop_column(op, conn, "pulse_projects", "staffing_priority")
    ah.safe_drop_column(op, conn, "pulse_projects", "operational_impact_level")
    ah.safe_drop_column(op, conn, "pulse_projects", "overlay_color")
    ah.safe_drop_column(op, conn, "pulse_projects", "show_on_schedule")
