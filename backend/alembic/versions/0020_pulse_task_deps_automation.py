"""Pulse: task dependencies + project automation rules."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_task_dependencies",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "depends_on_task_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.CheckConstraint("task_id <> depends_on_task_id", name="ck_pulse_task_dep_no_self"),
        sa.UniqueConstraint("task_id", "depends_on_task_id", name="uq_pulse_task_dep_pair"),
    )
    op.create_index("ix_pulse_task_dependencies_task_id", "pulse_task_dependencies", ["task_id"])
    op.create_index("ix_pulse_task_dependencies_depends_on", "pulse_task_dependencies", ["depends_on_task_id"])

    op.create_table(
        "pulse_project_automation_rules",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trigger_type", sa.String(32), nullable=False),
        sa.Column("condition_json", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("action_json", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_pulse_project_automation_rules_project_id", "pulse_project_automation_rules", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_project_automation_rules_project_id", table_name="pulse_project_automation_rules")
    op.drop_table("pulse_project_automation_rules")
    op.drop_index("ix_pulse_task_dependencies_depends_on", table_name="pulse_task_dependencies")
    op.drop_index("ix_pulse_task_dependencies_task_id", table_name="pulse_task_dependencies")
    op.drop_table("pulse_task_dependencies")
