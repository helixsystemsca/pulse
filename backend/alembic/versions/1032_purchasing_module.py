"""Quick purchases, purchase lines, vendor preferred flag."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1032_purchasing_module"
down_revision = "1031_seed_tenant_departments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "inventory_vendors"):
        ah.safe_add_column(
            op,
            conn,
            "inventory_vendors",
            sa.Column("preferred_vendor", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    if not ah.table_exists(conn, "purchasing_quick_purchases"):
        ah.safe_create_table(
            op,
            conn,
            "purchasing_quick_purchases",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "vendor_id",
                UUID(as_uuid=False),
                sa.ForeignKey("inventory_vendors.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("vendor_name", sa.String(255), nullable=True),
            sa.Column("purchase_date", sa.Date(), nullable=False),
            sa.Column("total_amount", sa.Float(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("receipt_filename", sa.String(512), nullable=True),
            sa.Column("receipt_content_type", sa.String(128), nullable=True),
            sa.Column("add_to_inventory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column(
                "created_by_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        ah.safe_create_index(
            op, conn, "ix_purchasing_quick_purchases_company_id", "purchasing_quick_purchases", ["company_id"]
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_purchasing_quick_purchases_purchase_date",
            "purchasing_quick_purchases",
            ["purchase_date"],
        )
        ah.safe_create_index(
            op, conn, "ix_purchasing_quick_purchases_vendor_id", "purchasing_quick_purchases", ["vendor_id"]
        )

    if not ah.table_exists(conn, "purchasing_quick_purchase_lines"):
        ah.safe_create_table(
            op,
            conn,
            "purchasing_quick_purchase_lines",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "purchase_id",
                UUID(as_uuid=False),
                sa.ForeignKey("purchasing_quick_purchases.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Float(), nullable=False, server_default="1"),
            sa.Column("unit_cost", sa.Float(), nullable=True),
            sa.Column("category", sa.String(128), nullable=True),
            sa.Column(
                "inventory_item_id",
                UUID(as_uuid=False),
                sa.ForeignKey("inventory_items.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "zone_id",
                UUID(as_uuid=False),
                sa.ForeignKey("zones.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("add_to_inventory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_purchasing_quick_purchase_lines_purchase_id",
            "purchasing_quick_purchase_lines",
            ["purchase_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_purchasing_quick_purchase_lines_purchase_id", "purchasing_quick_purchase_lines")
    ah.safe_drop_table(op, conn, "purchasing_quick_purchase_lines")
    ah.safe_drop_index(op, conn, "ix_purchasing_quick_purchases_vendor_id", "purchasing_quick_purchases")
    ah.safe_drop_index(op, conn, "ix_purchasing_quick_purchases_purchase_date", "purchasing_quick_purchases")
    ah.safe_drop_index(op, conn, "ix_purchasing_quick_purchases_company_id", "purchasing_quick_purchases")
    ah.safe_drop_table(op, conn, "purchasing_quick_purchases")
    ah.safe_drop_column(op, conn, "inventory_vendors", "preferred_vendor")
