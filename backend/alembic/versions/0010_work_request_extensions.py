"""Extend pulse work requests (priority string, due dates, comments, activity, settings).

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-01

"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    pr_type = conn.execute(
        text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'pulse_work_requests' "
            "AND column_name = 'priority'"
        )
    ).scalar()

    if pr_type == "integer":
        op.add_column(
            "pulse_work_requests",
            sa.Column("priority_new", sa.String(16), nullable=False, server_default="medium"),
        )
        op.execute(
            text(
                """
                UPDATE pulse_work_requests SET priority_new = CASE
                  WHEN priority <= 0 THEN 'low'
                  WHEN priority = 1 THEN 'medium'
                  WHEN priority = 2 THEN 'high'
                  ELSE 'critical'
                END
                """
            )
        )
        op.drop_column("pulse_work_requests", "priority")
        op.execute(text("ALTER TABLE pulse_work_requests RENAME COLUMN priority_new TO priority"))
        op.alter_column("pulse_work_requests", "priority", server_default=None)

    if not ah.column_exists(conn, "pulse_work_requests", "category"):
        op.add_column("pulse_work_requests", sa.Column("category", sa.String(128), nullable=True))
    if not ah.column_exists(conn, "pulse_work_requests", "due_date"):
        op.add_column(
            "pulse_work_requests", sa.Column("due_date", sa.DateTime(timezone=True), nullable=True)
        )
        op.create_index("ix_pulse_work_requests_due_date", "pulse_work_requests", ["due_date"])
    if not ah.column_exists(conn, "pulse_work_requests", "completed_at"):
        op.add_column(
            "pulse_work_requests",
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not ah.column_exists(conn, "pulse_work_requests", "created_by_user_id"):
        op.add_column(
            "pulse_work_requests",
            sa.Column(
                "created_by_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_pulse_work_requests_created_by_user_id", "pulse_work_requests", ["created_by_user_id"]
        )
    if not ah.column_exists(conn, "pulse_work_requests", "attachments"):
        op.add_column(
            "pulse_work_requests",
            sa.Column("attachments", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        )

    op.execute(
        text(
            """
            UPDATE pulse_work_requests SET status = 'completed' WHERE status = 'complete'
            """
        )
    )

    if not ah.table_exists(conn, "pulse_work_request_comments"):
        op.create_table(
            "pulse_work_request_comments",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "work_request_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_wr_comments_wr_id", "pulse_work_request_comments", ["work_request_id"])

    if not ah.table_exists(conn, "pulse_work_request_activity"):
        op.create_table(
            "pulse_work_request_activity",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "work_request_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("action", sa.String(64), nullable=False),
            sa.Column("performed_by", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("meta", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_wr_activity_wr_id", "pulse_work_request_activity", ["work_request_id"])

    if not ah.table_exists(conn, "pulse_work_request_settings"):
        op.create_table(
            "pulse_work_request_settings",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("settings", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("company_id", name="uq_wr_settings_company"),
        )
        op.create_index("ix_wr_settings_company_id", "pulse_work_request_settings", ["company_id"])


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "pulse_work_request_settings"):
        op.drop_table("pulse_work_request_settings")
    if ah.table_exists(conn, "pulse_work_request_activity"):
        op.drop_table("pulse_work_request_activity")
    if ah.table_exists(conn, "pulse_work_request_comments"):
        op.drop_table("pulse_work_request_comments")
    op.execute(text("UPDATE pulse_work_requests SET status = 'complete' WHERE status = 'completed'"))
    if ah.column_exists(conn, "pulse_work_requests", "attachments"):
        op.drop_column("pulse_work_requests", "attachments")
    if ah.column_exists(conn, "pulse_work_requests", "created_by_user_id"):
        op.drop_index("ix_pulse_work_requests_created_by_user_id", table_name="pulse_work_requests")
        op.drop_column("pulse_work_requests", "created_by_user_id")
    if ah.column_exists(conn, "pulse_work_requests", "completed_at"):
        op.drop_column("pulse_work_requests", "completed_at")
    if ah.column_exists(conn, "pulse_work_requests", "due_date"):
        op.drop_index("ix_pulse_work_requests_due_date", table_name="pulse_work_requests")
        op.drop_column("pulse_work_requests", "due_date")
    if ah.column_exists(conn, "pulse_work_requests", "category"):
        op.drop_column("pulse_work_requests", "category")
