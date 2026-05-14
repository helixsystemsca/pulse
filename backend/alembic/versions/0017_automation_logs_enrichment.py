"""Automation logs: severity + source_module.

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-30
"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "automation_logs"):
        ah.safe_add_column(
            op,
            conn,
            "automation_logs",
            sa.Column("severity", sa.String(16), server_default=text("'info'"), nullable=False),
        )
        ah.safe_add_column(
            op,
            conn,
            "automation_logs",
            sa.Column("source_module", sa.String(32), server_default=text("'ingest'"), nullable=False),
        )
        ah.safe_create_index(op, conn, "ix_automation_logs_severity", "automation_logs", ["severity"])
        ah.safe_create_index(op, conn, "ix_automation_logs_source_module", "automation_logs", ["source_module"])


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "automation_logs"):
        ah.safe_drop_index(op, conn, "ix_automation_logs_source_module", "automation_logs")
        ah.safe_drop_column(op, conn, "automation_logs", "source_module")
        ah.safe_drop_index(op, conn, "ix_automation_logs_severity", "automation_logs")
        ah.safe_drop_column(op, conn, "automation_logs", "severity")
