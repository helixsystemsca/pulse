"""Pulse: optional cache table for per-user performance metrics."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_user_performance_snapshots",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("time_window", sa.String(16), nullable=False),
        sa.Column("metrics_json", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "company_id", "time_window", name="uq_pulse_perf_snap_user_company_window"),
    )
    op.create_index("ix_pulse_perf_snap_company_window", "pulse_user_performance_snapshots", ["company_id", "time_window"])


def downgrade() -> None:
    op.drop_index("ix_pulse_perf_snap_company_window", table_name="pulse_user_performance_snapshots")
    op.drop_table("pulse_user_performance_snapshots")
