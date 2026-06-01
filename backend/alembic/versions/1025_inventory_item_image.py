"""Inventory item photo URL pointer."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1025_inventory_item_image"
down_revision = "1024_user_refresh_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("image_url", sa.String(2048), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_drop_column(op, conn, "inventory_items", "image_url")
