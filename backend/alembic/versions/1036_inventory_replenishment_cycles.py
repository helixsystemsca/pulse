"""Inventory replenishment cycle history for queue and restock analytics."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1036_inventory_replenishment_cycles"
down_revision = "1035_inventory_enterprise"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_replenishment_cycles"):
        return
    ah.safe_create_table(
        op,
        conn,
        "inventory_replenishment_cycles",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "inventory_item_id",
            UUID(as_uuid=False),
            sa.ForeignKey("inventory_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_name", sa.String(255), nullable=False),
        sa.Column("sku", sa.String(128), nullable=False),
        sa.Column("low_stock_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replenished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_in_queue_hours", sa.Float(), nullable=True),
        sa.Column("time_to_replenish_hours", sa.Float(), nullable=True),
        sa.Column(
            "export_batch_id",
            UUID(as_uuid=False),
            sa.ForeignKey("material_request_exports.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    ah.safe_create_index(
        op, conn, "ix_inventory_replenishment_cycles_company_id", "inventory_replenishment_cycles", ["company_id"]
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_inventory_replenishment_cycles_inventory_item_id",
        "inventory_replenishment_cycles",
        ["inventory_item_id"],
    )
    ah.safe_create_index(
        op, conn, "ix_inventory_replenishment_cycles_low_stock_at", "inventory_replenishment_cycles", ["low_stock_at"]
    )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_replenishment_cycles"):
        ah.safe_drop_table(op, conn, "inventory_replenishment_cycles")
