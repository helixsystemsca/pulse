"""Enterprise inventory: lifecycle, vendor links, checkouts, reorder intelligence, location balances."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1035_inventory_enterprise"
down_revision = "1034_storage_object_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "inventory_vendors"):
        ah.safe_add_column(
            op, conn, "inventory_vendors", sa.Column("lead_time_days", sa.Integer(), nullable=True)
        )

    if ah.table_exists(conn, "inventory_items"):
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("vendor_id", UUID(as_uuid=False), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("acquired_on", sa.Date(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("acquisition_cost", sa.Float(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("useful_life_months", sa.Integer(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("salvage_value", sa.Float(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("expected_retirement_on", sa.Date(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("disposed_on", sa.Date(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("disposal_method", sa.String(64), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("disposal_notes", sa.Text(), nullable=True))
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("depreciation_method", sa.String(32), nullable=True))
        ah.safe_create_index(op, conn, "ix_inventory_items_vendor_id", "inventory_items", ["vendor_id"])
        if ah.table_exists(conn, "inventory_vendors") and not ah.constraint_exists(
            conn, "inventory_items_vendor_id_fkey"
        ):
            try:
                op.create_foreign_key(
                    "inventory_items_vendor_id_fkey",
                    "inventory_items",
                    "inventory_vendors",
                    ["vendor_id"],
                    ["id"],
                    ondelete="SET NULL",
                )
            except Exception:
                pass

    if ah.table_exists(conn, "material_request_queue"):
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("priority_score", sa.Float(), nullable=False, server_default="0"))
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("days_until_stockout", sa.Float(), nullable=True))
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("urgency_tier", sa.String(16), nullable=False, server_default="normal"))
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("anomaly_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        ah.safe_alter_column_drop_server_default(op, conn, "material_request_queue", "priority_score")
        ah.safe_alter_column_drop_server_default(op, conn, "material_request_queue", "urgency_tier")
        ah.safe_alter_column_drop_server_default(op, conn, "material_request_queue", "anomaly_flag")

    if not ah.table_exists(conn, "inventory_checkouts"):
        ah.safe_create_table(
            op,
            conn,
            "inventory_checkouts",
            sa.Column("id", UUID(as_uuid=False), nullable=False),
            sa.Column("company_id", UUID(as_uuid=False), nullable=False),
            sa.Column("item_id", UUID(as_uuid=False), nullable=False),
            sa.Column("checked_out_by", UUID(as_uuid=False), nullable=False),
            sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expected_return_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("checked_in_by", UUID(as_uuid=False), nullable=True),
            sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("condition_out", sa.String(32), nullable=True),
            sa.Column("condition_in", sa.String(32), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("zone_id", UUID(as_uuid=False), nullable=True),
            sa.Column("movement_out_id", UUID(as_uuid=False), nullable=True),
            sa.Column("movement_in_id", UUID(as_uuid=False), nullable=True),
            sa.Column("photo_out_storage_key", sa.String(512), nullable=True),
            sa.Column("photo_in_storage_key", sa.String(512), nullable=True),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["checked_out_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["checked_in_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["zone_id"], ["zones.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["movement_out_id"], ["inventory_movements.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["movement_in_id"], ["inventory_movements.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        ah.safe_create_index(op, conn, "ix_inventory_checkouts_company_id", "inventory_checkouts", ["company_id"])
        ah.safe_create_index(op, conn, "ix_inventory_checkouts_item_id", "inventory_checkouts", ["item_id"])
        ah.safe_create_index(op, conn, "ix_inventory_checkouts_open", "inventory_checkouts", ["item_id", "checked_in_at"])

    if not ah.table_exists(conn, "inventory_reorder_policies"):
        ah.safe_create_table(
            op,
            conn,
            "inventory_reorder_policies",
            sa.Column("id", UUID(as_uuid=False), nullable=False),
            sa.Column("company_id", UUID(as_uuid=False), nullable=False),
            sa.Column("item_id", UUID(as_uuid=False), nullable=False),
            sa.Column("base_low_stock_threshold", sa.Float(), nullable=True),
            sa.Column("consumption_lookback_days", sa.Integer(), nullable=False, server_default="90"),
            sa.Column("seasonal_multipliers", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("event_boosts", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("item_id", name="uq_inventory_reorder_policies_item"),
        )
        ah.safe_create_index(op, conn, "ix_inventory_reorder_policies_company", "inventory_reorder_policies", ["company_id"])

    if not ah.table_exists(conn, "inventory_location_balances"):
        ah.safe_create_table(
            op,
            conn,
            "inventory_location_balances",
            sa.Column("id", UUID(as_uuid=False), nullable=False),
            sa.Column("company_id", UUID(as_uuid=False), nullable=False),
            sa.Column("item_id", UUID(as_uuid=False), nullable=False),
            sa.Column("zone_id", UUID(as_uuid=False), nullable=False),
            sa.Column("quantity", sa.Float(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["zone_id"], ["zones.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("item_id", "zone_id", name="uq_inventory_location_balance"),
        )
        ah.safe_create_index(op, conn, "ix_inventory_location_balances_item", "inventory_location_balances", ["item_id"])


def downgrade() -> None:
    conn = op.get_bind()
    for table in ("inventory_location_balances", "inventory_reorder_policies", "inventory_checkouts"):
        if ah.table_exists(conn, table):
            op.drop_table(table)
    if ah.table_exists(conn, "material_request_queue"):
        for col in ("anomaly_flag", "urgency_tier", "days_until_stockout", "priority_score"):
            ah.safe_drop_column(op, conn, "material_request_queue", col)
    if ah.table_exists(conn, "inventory_items"):
        for col in (
            "depreciation_method",
            "disposal_notes",
            "disposal_method",
            "disposed_on",
            "expected_retirement_on",
            "salvage_value",
            "useful_life_months",
            "acquisition_cost",
            "acquired_on",
            "vendor_id",
        ):
            ah.safe_drop_column(op, conn, "inventory_items", col)
    if ah.table_exists(conn, "inventory_vendors"):
        ah.safe_drop_column(op, conn, "inventory_vendors", "lead_time_days")
