"""Default temporary password for admin-created roster employees."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1028_companies_default_roster_password"
down_revision = "1027_companies_header_wordmark"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_add_column(
            op,
            conn,
            "companies",
            sa.Column("default_roster_password", sa.String(128), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_drop_column(op, conn, "companies", "default_roster_password")
