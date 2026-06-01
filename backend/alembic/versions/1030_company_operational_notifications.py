"""Per-tenant operational notification recipients (inventory low stock, etc.)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1030_company_operational_notifications"
down_revision = "1029_material_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_add_column(
            op,
            conn,
            "companies",
            sa.Column("operational_notifications", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_drop_column(op, conn, "companies", "operational_notifications")
