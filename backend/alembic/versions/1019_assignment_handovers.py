"""Routine assignment handover notes for shift continuity."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1019_assignment_handovers"
down_revision = "1018_work_order_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "pulse_routine_assignment_handovers"):
        return

    op.create_table(
        "pulse_routine_assignment_handovers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "routine_assignment_id",
            sa.String(36),
            sa.ForeignKey("pulse_routine_assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("author_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("employee_name", sa.String(255), nullable=True),
        sa.Column("department_slug", sa.String(64), nullable=True),
        sa.Column("operational_area", sa.String(255), nullable=True),
        sa.Column("shift_id", sa.String(36), nullable=True),
        sa.Column("shift_label", sa.String(128), nullable=True),
        sa.Column("assignment_date", sa.Date(), nullable=True),
        sa.Column("note_type", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_edited_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("attachment_path", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_pulse_routine_assignment_handovers_company_id",
        "pulse_routine_assignment_handovers",
        ["company_id"],
    )
    op.create_index(
        "ix_pulse_routine_assignment_handovers_routine_assignment_id",
        "pulse_routine_assignment_handovers",
        ["routine_assignment_id"],
    )
    op.create_index(
        "ix_pulse_routine_assignment_handovers_assignment_date",
        "pulse_routine_assignment_handovers",
        ["assignment_date"],
    )
    op.create_index(
        "ix_pulse_routine_assignment_handovers_note_type",
        "pulse_routine_assignment_handovers",
        ["note_type"],
    )
    op.create_index(
        "ix_pulse_routine_assignment_handovers_is_resolved",
        "pulse_routine_assignment_handovers",
        ["is_resolved"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "pulse_routine_assignment_handovers"):
        return
    op.drop_table("pulse_routine_assignment_handovers")
