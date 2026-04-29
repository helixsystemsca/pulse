"""soft start pm plans

Revision ID: 0081_soft_start_pm_plans
Revises: 0080_gamification_g5_badges
Create Date: 2026-04-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0081_soft_start_pm_plans"
down_revision = "0080_gamification_g5_badges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_pm_plans",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("custom_interval_days", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("due_time_offset_days", sa.Integer(), nullable=True),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("template_id", sa.String(length=128), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pulse_pm_plans_company_id", "pulse_pm_plans", ["company_id"])
    op.create_index("ix_pulse_pm_plans_start_date", "pulse_pm_plans", ["start_date"])
    op.create_index("ix_pulse_pm_plans_next_due_at", "pulse_pm_plans", ["next_due_at"])
    op.create_index("ix_pulse_pm_plans_assigned_user_id", "pulse_pm_plans", ["assigned_user_id"])
    op.create_index("ix_pulse_pm_plans_equipment_id", "pulse_pm_plans", ["equipment_id"])
    op.create_index("ix_pulse_pm_plans_template_id", "pulse_pm_plans", ["template_id"])

    op.add_column(
        "pulse_work_requests",
        sa.Column(
            "pm_plan_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("pulse_pm_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("pulse_work_requests", sa.Column("work_request_kind", sa.String(length=64), nullable=True))
    op.create_index("ix_pulse_work_requests_pm_plan_id", "pulse_work_requests", ["pm_plan_id"])
    op.create_index("ix_pulse_work_requests_work_request_kind", "pulse_work_requests", ["work_request_kind"])


def downgrade() -> None:
    op.drop_index("ix_pulse_work_requests_work_request_kind", table_name="pulse_work_requests")
    op.drop_index("ix_pulse_work_requests_pm_plan_id", table_name="pulse_work_requests")
    op.drop_column("pulse_work_requests", "work_request_kind")
    op.drop_column("pulse_work_requests", "pm_plan_id")

    op.drop_index("ix_pulse_pm_plans_template_id", table_name="pulse_pm_plans")
    op.drop_index("ix_pulse_pm_plans_equipment_id", table_name="pulse_pm_plans")
    op.drop_index("ix_pulse_pm_plans_assigned_user_id", table_name="pulse_pm_plans")
    op.drop_index("ix_pulse_pm_plans_next_due_at", table_name="pulse_pm_plans")
    op.drop_index("ix_pulse_pm_plans_start_date", table_name="pulse_pm_plans")
    op.drop_index("ix_pulse_pm_plans_company_id", table_name="pulse_pm_plans")
    op.drop_table("pulse_pm_plans")

