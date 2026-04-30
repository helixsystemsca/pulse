"""project critical path steps

Revision ID: 0086_prj_critical_path
Revises: 0085_project_categories
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0086_prj_critical_path"
down_revision = "0085_project_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_project_critical_steps",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "depends_on_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_project_critical_steps.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
    )
    op.create_index("ix_pulse_project_critical_steps_company_id", "pulse_project_critical_steps", ["company_id"])
    op.create_index("ix_pulse_project_critical_steps_project_id", "pulse_project_critical_steps", ["project_id"])
    op.create_index("ix_pulse_project_critical_steps_depends_on_id", "pulse_project_critical_steps", ["depends_on_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_project_critical_steps_depends_on_id", table_name="pulse_project_critical_steps")
    op.drop_index("ix_pulse_project_critical_steps_project_id", table_name="pulse_project_critical_steps")
    op.drop_index("ix_pulse_project_critical_steps_company_id", table_name="pulse_project_critical_steps")
    op.drop_table("pulse_project_critical_steps")

