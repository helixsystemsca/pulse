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
        if not ah.column_exists(conn, "automation_logs", "severity"):
            op.add_column(
                "automation_logs",
                sa.Column("severity", sa.String(16), server_default=text("'info'"), nullable=False),
            )
        if not ah.column_exists(conn, "automation_logs", "source_module"):
            op.add_column(
                "automation_logs",
                sa.Column("source_module", sa.String(32), server_default=text("'ingest'"), nullable=False),
            )
        op.create_index("ix_automation_logs_severity", "automation_logs", ["severity"])
        op.create_index("ix_automation_logs_source_module", "automation_logs", ["source_module"])


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "automation_logs"):
        if ah.column_exists(conn, "automation_logs", "source_module"):
            op.drop_index("ix_automation_logs_source_module", table_name="automation_logs")
            op.drop_column("automation_logs", "source_module")
        if ah.column_exists(conn, "automation_logs", "severity"):
            op.drop_index("ix_automation_logs_severity", table_name="automation_logs")
            op.drop_column("automation_logs", "severity")
