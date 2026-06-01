"""Custom field values on inventory items (tenant-configured register form)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1026_inventory_custom_attributes"
down_revision = "1025_inventory_item_image"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_add_column(
            op,
            conn,
            "inventory_items",
            sa.Column("custom_attributes", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_drop_column(op, conn, "inventory_items", "custom_attributes")
