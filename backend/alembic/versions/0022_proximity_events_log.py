"""Accountability: proximity opportunity log (missed / resolved)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_proximity_events_log",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_tag_id", sa.String(128), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tasks_present", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("action_taken", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("action_task_id", UUID(as_uuid=False), sa.ForeignKey("pulse_project_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_missed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("missed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pulse_proximity_log_company_detected", "pulse_proximity_events_log", ["company_id", "detected_at"])
    op.create_index("ix_pulse_proximity_log_user_detected", "pulse_proximity_events_log", ["user_id", "detected_at"])


def downgrade() -> None:
    op.drop_index("ix_pulse_proximity_log_user_detected", table_name="pulse_proximity_events_log")
    op.drop_index("ix_pulse_proximity_log_company_detected", table_name="pulse_proximity_events_log")
    op.drop_table("pulse_proximity_events_log")
