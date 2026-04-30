"""project categories

Revision ID: 0085_project_categories
Revises: 0084_project_templates_task_planning
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0085_project_categories"
down_revision = "0084_project_templates_task_planning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_categories",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("color", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
        sa.UniqueConstraint("company_id", "name", name="uq_pulse_category_company_name"),
    )
    op.create_index("ix_pulse_categories_company_id", "pulse_categories", ["company_id"])
    op.create_index("ix_pulse_categories_name", "pulse_categories", ["name"])

    op.add_column(
        "pulse_projects",
        sa.Column(
            "category_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pulse_projects_category_id", "pulse_projects", ["category_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_projects_category_id", table_name="pulse_projects")
    op.drop_column("pulse_projects", "category_id")

    op.drop_index("ix_pulse_categories_name", table_name="pulse_categories")
    op.drop_index("ix_pulse_categories_company_id", table_name="pulse_categories")
    op.drop_table("pulse_categories")

