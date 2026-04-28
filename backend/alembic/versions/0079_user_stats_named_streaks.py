"""UserStats.streaks JSONB for daily_activity, pm_on_time, no_flags, shift_attendance.

Revision ID: 0079_named_streaks
Revises: 0078_sched_p2
Create Date: 2026-04-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0079_named_streaks"
down_revision = "0078_sched_p2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_stats",
        sa.Column(
            "streaks",
            JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_stats", "streaks")
