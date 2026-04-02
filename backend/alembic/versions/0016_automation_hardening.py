"""Automation hardening: event idempotency + observability logs.

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-30
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

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "automation_events") and not ah.column_exists(
        conn, "automation_events", "idempotency_key"
    ):
        op.add_column("automation_events", sa.Column("idempotency_key", sa.Text(), nullable=True))
        op.create_index("ix_automation_events_idempotency_key", "automation_events", ["idempotency_key"])
        op.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_events_company_idempotency "
                "ON automation_events (company_id, idempotency_key) "
                "WHERE idempotency_key IS NOT NULL"
            )
        )

    if not ah.table_exists(conn, "automation_logs"):
        op.create_table(
            "automation_logs",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column("type", sa.String(64), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("payload", JSONB, server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
        )
        op.create_index("ix_automation_logs_company_id", "automation_logs", ["company_id"])
        op.create_index("ix_automation_logs_type", "automation_logs", ["type"])
        op.create_index("ix_automation_logs_created_at", "automation_logs", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "automation_logs"):
        op.drop_table("automation_logs")

    if ah.table_exists(conn, "automation_events") and ah.column_exists(conn, "automation_events", "idempotency_key"):
        op.execute(text("DROP INDEX IF EXISTS uq_automation_events_company_idempotency"))
        op.drop_index("ix_automation_events_idempotency_key", table_name="automation_events")
        op.drop_column("automation_events", "idempotency_key")
