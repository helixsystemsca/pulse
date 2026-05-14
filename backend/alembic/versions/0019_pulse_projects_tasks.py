"""Pulse: projects, project tasks, schedule shift kind + display label."""

from __future__ import annotations

from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("shift_kind", sa.String(32), nullable=False, server_default="workforce"),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("display_label", sa.String(512), nullable=True),
    )

    if not ah.table_exists(conn, "pulse_projects"):
        op.create_table(
            "pulse_projects",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
    ah.safe_create_index(op, conn, "ix_pulse_projects_company_id", "pulse_projects", ["company_id"])

    if not ah.table_exists(conn, "pulse_project_tasks"):
        op.create_table(
            "pulse_project_tasks",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "project_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(512), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column(
                "assigned_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
            sa.Column("status", sa.String(32), nullable=False, server_default="todo"),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column(
                "calendar_shift_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_schedule_shifts.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
    ah.safe_create_index(op, conn, "ix_pulse_project_tasks_company_id", "pulse_project_tasks", ["company_id"])
    ah.safe_create_index(op, conn, "ix_pulse_project_tasks_project_id", "pulse_project_tasks", ["project_id"])
    ah.safe_create_index(op, conn, "ix_pulse_project_tasks_status", "pulse_project_tasks", ["status"])
    ah.safe_create_index(op, conn, "ix_pulse_project_tasks_due_date", "pulse_project_tasks", ["due_date"])
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_project_tasks_calendar_shift_id_unique",
        "pulse_project_tasks",
        ["calendar_shift_id"],
        unique=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "pulse_project_tasks"):
        ah.safe_drop_index(op, conn, "ix_pulse_project_tasks_calendar_shift_id_unique", "pulse_project_tasks")
        ah.safe_drop_index(op, conn, "ix_pulse_project_tasks_due_date", "pulse_project_tasks")
        ah.safe_drop_index(op, conn, "ix_pulse_project_tasks_status", "pulse_project_tasks")
        ah.safe_drop_index(op, conn, "ix_pulse_project_tasks_project_id", "pulse_project_tasks")
        ah.safe_drop_index(op, conn, "ix_pulse_project_tasks_company_id", "pulse_project_tasks")
        op.drop_table("pulse_project_tasks")
    if ah.table_exists(conn, "pulse_projects"):
        ah.safe_drop_index(op, conn, "ix_pulse_projects_company_id", "pulse_projects")
        op.drop_table("pulse_projects")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "display_label")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "shift_kind")
