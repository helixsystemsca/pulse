"""Team Management workspace — career, recognition, meetings, action items."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1043_team_management_workspace"
down_revision = "1042_worker_development"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_add_column(
        op,
        conn,
        "pulse_worker_development",
        sa.Column("career", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_worker_development",
        sa.Column("recognitions", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )

    ah.safe_create_table(
        op,
        conn,
        "pulse_worker_meetings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "manager_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("meeting_type", sa.String(32), nullable=False, server_default=sa.text("'one_on_one'")),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'upcoming'")),
        sa.Column("agenda", sa.Text(), nullable=True),
        sa.Column("wins", sa.Text(), nullable=True),
        sa.Column("challenges", sa.Text(), nullable=True),
        sa.Column("goals", sa.Text(), nullable=True),
        sa.Column("manager_notes", sa.Text(), nullable=True),
        sa.Column("employee_notes", sa.Text(), nullable=True),
        sa.Column("next_meeting_date", sa.Date(), nullable=True),
        sa.Column("recurrence", sa.String(32), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_worker_meetings_company_id", "pulse_worker_meetings", ["company_id"]
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_worker_meetings_employee_user_id", "pulse_worker_meetings", ["employee_user_id"]
    )

    ah.safe_create_table(
        op,
        conn,
        "pulse_meeting_action_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "meeting_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_worker_meetings.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "employee_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_to_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'open'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("project_id", UUID(as_uuid=False), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_meeting_action_items_company_id", "pulse_meeting_action_items", ["company_id"]
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_meeting_action_items_employee_user_id",
        "pulse_meeting_action_items",
        ["employee_user_id"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, "pulse_meeting_action_items")
    ah.safe_drop_table(op, conn, "pulse_worker_meetings")
    ah.safe_drop_column(op, conn, "pulse_worker_development", "recognitions")
    ah.safe_drop_column(op, conn, "pulse_worker_development", "career")
