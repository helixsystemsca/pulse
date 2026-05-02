"""Internal PM coordination layer (gated by user.can_use_pm_features; not pulse_projects).

Revision ID: 0097_pm_coordination_layer
Revises: 0096_facility_maps
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0097_pm_coordination_layer"
down_revision = "0096_facility_maps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pm_coord_projects",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("deliverables", sa.Text(), nullable=True),
        sa.Column("definition_of_done", sa.Text(), nullable=True),
        sa.Column("current_update", sa.Text(), nullable=True),
        sa.Column("post_project_review", sa.Text(), nullable=True),
        sa.Column("readiness_tasks_defined", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("readiness_materials_ready", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("readiness_dependencies_set", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pm_coord_projects_company", "pm_coord_projects", ["company_id"])

    op.create_table(
        "pm_coord_tasks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="not_started"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pm_coord_tasks_project", "pm_coord_tasks", ["project_id"])
    op.create_index("ix_pm_coord_tasks_company", "pm_coord_tasks", ["company_id"])
    op.create_index("ix_pm_coord_tasks_parent", "pm_coord_tasks", ["parent_task_id"])

    op.create_table(
        "pm_coord_task_dependencies",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "depends_on_task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("task_id", "depends_on_task_id", name="uq_pm_coord_dep_pair"),
        sa.CheckConstraint("task_id <> depends_on_task_id", name="ck_pm_coord_dep_no_self"),
    )
    op.create_index("ix_pm_coord_dep_task", "pm_coord_task_dependencies", ["task_id"])
    op.create_index("ix_pm_coord_dep_prereq", "pm_coord_task_dependencies", ["depends_on_task_id"])

    op.create_table(
        "pm_coord_risks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("risk_description", sa.Text(), nullable=False),
        sa.Column("impact", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("mitigation_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pm_coord_risks_project", "pm_coord_risks", ["project_id"])

    op.create_table(
        "pm_coord_task_resources",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("resource_kind", sa.String(length=32), nullable=False, server_default="material"),
        sa.Column("label", sa.String(length=512), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "inventory_item_id",
            UUID(as_uuid=False),
            sa.ForeignKey("inventory_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tool_id", UUID(as_uuid=False), sa.ForeignKey("tools.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pm_coord_res_task", "pm_coord_task_resources", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_pm_coord_res_task", table_name="pm_coord_task_resources")
    op.drop_table("pm_coord_task_resources")

    op.drop_index("ix_pm_coord_risks_project", table_name="pm_coord_risks")
    op.drop_table("pm_coord_risks")

    op.drop_index("ix_pm_coord_dep_prereq", table_name="pm_coord_task_dependencies")
    op.drop_index("ix_pm_coord_dep_task", table_name="pm_coord_task_dependencies")
    op.drop_table("pm_coord_task_dependencies")

    op.drop_index("ix_pm_coord_tasks_parent", table_name="pm_coord_tasks")
    op.drop_index("ix_pm_coord_tasks_company", table_name="pm_coord_tasks")
    op.drop_index("ix_pm_coord_tasks_project", table_name="pm_coord_tasks")
    op.drop_table("pm_coord_tasks")

    op.drop_index("ix_pm_coord_projects_company", table_name="pm_coord_projects")
    op.drop_table("pm_coord_projects")
