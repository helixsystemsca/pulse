"""Tenant-configurable app header wordmark (replaces fixed Helix logo in nav)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1027_companies_header_wordmark"
down_revision = "1026_inventory_custom_attributes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_add_column(
            op,
            conn,
            "companies",
            sa.Column("header_wordmark", sa.String(64), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "companies"):
        ah.safe_drop_column(op, conn, "companies", "header_wordmark")
