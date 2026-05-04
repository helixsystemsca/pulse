"""pulse_project_summaries: persisted project summary JSON snapshots."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0101_pulse_project_summaries"
down_revision = "0100_procedure_search_keywords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_project_summaries",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), nullable=False),
        sa.Column(
            "snapshot_json",
            JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "metrics_json",
            JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "user_inputs_json",
            JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), server_default=sa.text("'draft'"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["pulse_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_pulse_project_summaries_project_id",
        "pulse_project_summaries",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_project_summaries_project_id", table_name="pulse_project_summaries")
    op.drop_table("pulse_project_summaries")
