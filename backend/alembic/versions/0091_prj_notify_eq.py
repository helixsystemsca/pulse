"""project notification settings + task equipment links

Revision ID: 0091_prj_notify_eq
Revises: 0090_prj_completed_at
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0091_prj_notify_eq"
down_revision = "0090_prj_completed_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_projects",
        sa.Column("notification_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("notification_material_days", sa.Integer(), nullable=False, server_default="30"),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("notification_equipment_days", sa.Integer(), nullable=False, server_default="7"),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("notification_to_supervision", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("notification_to_lead", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("notification_to_owner", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "pulse_project_task_equipment",
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
            "facility_equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
    )
    op.create_index("ix_pulse_project_task_equipment_company_id", "pulse_project_task_equipment", ["company_id"])
    op.create_index("ix_pulse_project_task_equipment_project_id", "pulse_project_task_equipment", ["project_id"])
    op.create_index("ix_pulse_project_task_equipment_task_id", "pulse_project_task_equipment", ["task_id"])
    op.create_index(
        "ix_pulse_project_task_equipment_facility_equipment_id",
        "pulse_project_task_equipment",
        ["facility_equipment_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_project_task_equipment_facility_equipment_id", table_name="pulse_project_task_equipment")
    op.drop_index("ix_pulse_project_task_equipment_task_id", table_name="pulse_project_task_equipment")
    op.drop_index("ix_pulse_project_task_equipment_project_id", table_name="pulse_project_task_equipment")
    op.drop_index("ix_pulse_project_task_equipment_company_id", table_name="pulse_project_task_equipment")
    op.drop_table("pulse_project_task_equipment")

    op.drop_column("pulse_projects", "notification_to_owner")
    op.drop_column("pulse_projects", "notification_to_lead")
    op.drop_column("pulse_projects", "notification_to_supervision")
    op.drop_column("pulse_projects", "notification_equipment_days")
    op.drop_column("pulse_projects", "notification_material_days")
    op.drop_column("pulse_projects", "notification_enabled")
