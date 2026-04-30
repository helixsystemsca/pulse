"""project activity log + hidden project fields

Revision ID: 0083_project_activity_hidden_fields
Revises: 0082_onboarding_tiered_progress
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0083_project_activity_hidden_fields"
down_revision = "0082_onboarding_tiered_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_projects", sa.Column("goal", sa.Text(), nullable=True))
    op.add_column("pulse_projects", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("pulse_projects", sa.Column("success_definition", sa.Text(), nullable=True))
    op.add_column("pulse_projects", sa.Column("current_phase", sa.String(32), nullable=True))
    op.add_column("pulse_projects", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("pulse_projects", sa.Column("metrics", sa.Text(), nullable=True))
    op.add_column("pulse_projects", sa.Column("lessons_learned", sa.Text(), nullable=True))

    op.create_table(
        "pulse_project_activity",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
    )
    op.create_index("ix_pulse_project_activity_project_id", "pulse_project_activity", ["project_id"])
    op.create_index("ix_pulse_project_activity_type", "pulse_project_activity", ["type"])
    op.create_index("ix_pulse_project_activity_created_at", "pulse_project_activity", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_pulse_project_activity_created_at", table_name="pulse_project_activity")
    op.drop_index("ix_pulse_project_activity_type", table_name="pulse_project_activity")
    op.drop_index("ix_pulse_project_activity_project_id", table_name="pulse_project_activity")
    op.drop_table("pulse_project_activity")

    op.drop_column("pulse_projects", "lessons_learned")
    op.drop_column("pulse_projects", "metrics")
    op.drop_column("pulse_projects", "summary")
    op.drop_column("pulse_projects", "current_phase")
    op.drop_column("pulse_projects", "success_definition")
    op.drop_column("pulse_projects", "notes")
    op.drop_column("pulse_projects", "goal")

