"""Schedule Phase 1 foundation tables + shift extensions

Revision ID: 0077_sched_p1
Revises: 0076_shift_facility
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0077_sched_p1"
down_revision = "0076_shift_facility"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Shift definitions
    op.create_table(
        "pulse_schedule_shift_definitions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.Column("start_min", sa.Integer(), nullable=False),
        sa.Column("end_min", sa.Integer(), nullable=False),
        sa.Column("shift_type", sa.String(length=32), nullable=False, server_default="day"),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("cert_requirements", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("company_id", "code", name="uq_sched_shift_def_company_code"),
        sa.CheckConstraint("start_min >= 0 AND start_min < 1440", name="ck_sched_shift_def_start_min"),
        sa.CheckConstraint("end_min >= 0 AND end_min < 1440", name="ck_sched_shift_def_end_min"),
    )
    op.create_index(
        "ix_sched_shift_def_company_id",
        "pulse_schedule_shift_definitions",
        ["company_id"],
    )

    # 2) Extend pulse_schedule_shifts (all nullable to avoid breaking existing rows)
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("shift_definition_id", UUID(as_uuid=False), nullable=True),
    )
    op.create_foreign_key(
        "fk_pulse_schedule_shifts_shift_definition_id",
        "pulse_schedule_shifts",
        "pulse_schedule_shift_definitions",
        ["shift_definition_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_pulse_schedule_shifts_shift_definition_id",
        "pulse_schedule_shifts",
        ["shift_definition_id"],
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("shift_code", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3) Schedule periods
    op.create_table(
        "pulse_schedule_periods",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("availability_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("publish_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.CheckConstraint("start_date <= end_date", name="ck_sched_period_dates"),
    )
    op.create_index("ix_sched_period_company_id", "pulse_schedule_periods", ["company_id"])
    op.create_index("ix_sched_period_start_date", "pulse_schedule_periods", ["start_date"])


def downgrade() -> None:
    op.drop_index("ix_sched_period_start_date", table_name="pulse_schedule_periods")
    op.drop_index("ix_sched_period_company_id", table_name="pulse_schedule_periods")
    op.drop_table("pulse_schedule_periods")

    op.drop_column("pulse_schedule_shifts", "published_at")
    op.drop_column("pulse_schedule_shifts", "is_draft")
    op.drop_column("pulse_schedule_shifts", "shift_code")
    op.drop_index("ix_pulse_schedule_shifts_shift_definition_id", table_name="pulse_schedule_shifts")
    op.drop_constraint("fk_pulse_schedule_shifts_shift_definition_id", "pulse_schedule_shifts", type_="foreignkey")
    op.drop_column("pulse_schedule_shifts", "shift_definition_id")

    op.drop_index("ix_sched_shift_def_company_id", table_name="pulse_schedule_shift_definitions")
    op.drop_table("pulse_schedule_shift_definitions")

