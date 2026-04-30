"""project materials repopulate

Revision ID: 0089_prj_materials_repop
Revises: 0088_task_estimates_actuals
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0089_prj_materials_repop"
down_revision = "0088_task_estimates_actuals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_projects", sa.Column("repopulation_frequency", sa.String(32), nullable=True))
    op.add_column("pulse_projects", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_pulse_projects_archived_at", "pulse_projects", ["archived_at"])

    op.create_table(
        "pulse_project_task_materials",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "inventory_item_id",
            UUID(as_uuid=False),
            sa.ForeignKey("inventory_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quantity_required", sa.Float(), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
    )
    op.create_index("ix_pulse_project_task_materials_company_id", "pulse_project_task_materials", ["company_id"])
    op.create_index("ix_pulse_project_task_materials_project_id", "pulse_project_task_materials", ["project_id"])
    op.create_index("ix_pulse_project_task_materials_task_id", "pulse_project_task_materials", ["task_id"])
    op.create_index("ix_pulse_project_task_materials_inventory_item_id", "pulse_project_task_materials", ["inventory_item_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_project_task_materials_inventory_item_id", table_name="pulse_project_task_materials")
    op.drop_index("ix_pulse_project_task_materials_task_id", table_name="pulse_project_task_materials")
    op.drop_index("ix_pulse_project_task_materials_project_id", table_name="pulse_project_task_materials")
    op.drop_index("ix_pulse_project_task_materials_company_id", table_name="pulse_project_task_materials")
    op.drop_table("pulse_project_task_materials")

    op.drop_index("ix_pulse_projects_archived_at", table_name="pulse_projects")
    op.drop_column("pulse_projects", "archived_at")
    op.drop_column("pulse_projects", "repopulation_frequency")

