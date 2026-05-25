"""Routine assignment handover notes for shift continuity."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1019_assignment_handovers"
down_revision = "1018_work_order_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "pulse_routine_assignment_handovers",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("routine_assignment_id", UUID(as_uuid=False), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("employee_user_id", UUID(as_uuid=False), nullable=True),
        sa.Column("employee_name", sa.String(255), nullable=True),
        sa.Column("department_slug", sa.String(64), nullable=True),
        sa.Column("operational_area", sa.String(255), nullable=True),
        sa.Column("shift_id", UUID(as_uuid=False), nullable=True),
        sa.Column("shift_label", sa.String(128), nullable=True),
        sa.Column("assignment_date", sa.Date(), nullable=True),
        sa.Column("note_type", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", UUID(as_uuid=False), nullable=True),
        sa.Column("last_edited_by_user_id", UUID(as_uuid=False), nullable=True),
        sa.Column("attachment_path", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["routine_assignment_id"],
            ["pulse_routine_assignments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["last_edited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_company_id",
        "pulse_routine_assignment_handovers",
        ["company_id"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_routine_assignment_id",
        "pulse_routine_assignment_handovers",
        ["routine_assignment_id"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_assignment_date",
        "pulse_routine_assignment_handovers",
        ["assignment_date"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_note_type",
        "pulse_routine_assignment_handovers",
        ["note_type"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_is_resolved",
        "pulse_routine_assignment_handovers",
        ["is_resolved"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(
        op, conn, "ix_pulse_routine_assignment_handovers_is_resolved", "pulse_routine_assignment_handovers"
    )
    ah.safe_drop_index(
        op, conn, "ix_pulse_routine_assignment_handovers_note_type", "pulse_routine_assignment_handovers"
    )
    ah.safe_drop_index(
        op, conn, "ix_pulse_routine_assignment_handovers_assignment_date", "pulse_routine_assignment_handovers"
    )
    ah.safe_drop_index(
        op,
        conn,
        "ix_pulse_routine_assignment_handovers_routine_assignment_id",
        "pulse_routine_assignment_handovers",
    )
    ah.safe_drop_index(
        op, conn, "ix_pulse_routine_assignment_handovers_company_id", "pulse_routine_assignment_handovers"
    )
    ah.safe_drop_table(op, conn, "pulse_routine_assignment_handovers")
