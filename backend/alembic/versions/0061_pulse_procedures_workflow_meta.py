"""pulse_procedures: creator + review workflow columns

Revision ID: 0061_pulse_procedures_workflow_meta
Revises: 0060_pulse_schedule_assignments
Create Date: 2026-04-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision = "0061_pulse_procedures_workflow_meta"
down_revision = "0060_pulse_schedule_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column("created_by_user_id", UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("created_by_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("review_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("reviewed_by_user_id", UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("reviewed_by_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_pulse_procedures_created_by_user_id_users",
        "pulse_procedures",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_pulse_procedures_reviewed_by_user_id_users",
        "pulse_procedures",
        "users",
        ["reviewed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pulse_procedures_created_by_user_id", "pulse_procedures", ["created_by_user_id"])
    op.alter_column("pulse_procedures", "review_required", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_pulse_procedures_created_by_user_id", table_name="pulse_procedures")
    op.drop_constraint("fk_pulse_procedures_reviewed_by_user_id_users", "pulse_procedures", type_="foreignkey")
    op.drop_constraint("fk_pulse_procedures_created_by_user_id_users", "pulse_procedures", type_="foreignkey")
    op.drop_column("pulse_procedures", "reviewed_at")
    op.drop_column("pulse_procedures", "reviewed_by_name")
    op.drop_column("pulse_procedures", "reviewed_by_user_id")
    op.drop_column("pulse_procedures", "review_required")
    op.drop_column("pulse_procedures", "created_by_name")
    op.drop_column("pulse_procedures", "created_by_user_id")
