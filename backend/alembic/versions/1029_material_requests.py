"""Material request queue, drafts, and optional inventory maximum_qty."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1029_material_requests"
down_revision = "1028_companies_default_roster_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_add_column(op, conn, "inventory_items", sa.Column("maximum_qty", sa.Float(), nullable=True))

    if not ah.table_exists(conn, "material_request_queue"):
        ah.safe_create_table(
            op,
            conn,
            "material_request_queue",
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
            sa.Column("category", sa.String(128), nullable=True),
            sa.Column("vendor", sa.String(255), nullable=True),
            sa.Column("current_qty", sa.Float(), nullable=False, server_default="0"),
            sa.Column("minimum_qty", sa.Float(), nullable=False, server_default="0"),
            sa.Column("maximum_qty", sa.Float(), nullable=True),
            sa.Column("reorder_qty", sa.Float(), nullable=False, server_default="0"),
            sa.Column("estimated_unit_cost", sa.Float(), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        ah.safe_create_index(
            op, conn, "ix_material_request_queue_company_id", "material_request_queue", ["company_id"]
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_material_request_queue_inventory_item_id",
            "material_request_queue",
            ["inventory_item_id"],
        )
        ah.safe_create_index(op, conn, "ix_material_request_queue_status", "material_request_queue", ["status"])

    if not ah.table_exists(conn, "material_request_drafts"):
        ah.safe_create_table(
            op,
            conn,
            "material_request_drafts",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("draft_number", sa.String(64), nullable=False),
            sa.Column(
                "created_by_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        ah.safe_create_index(
            op, conn, "ix_material_request_drafts_company_id", "material_request_drafts", ["company_id"]
        )
        ah.safe_create_index(
            op, conn, "ix_material_request_drafts_draft_number", "material_request_drafts", ["draft_number"]
        )

    if not ah.table_exists(conn, "material_request_draft_items"):
        ah.safe_create_table(
            op,
            conn,
            "material_request_draft_items",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "draft_id",
                UUID(as_uuid=False),
                sa.ForeignKey("material_request_drafts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "queue_item_id",
                UUID(as_uuid=False),
                sa.ForeignKey("material_request_queue.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("item_name", sa.String(255), nullable=False),
            sa.Column("sku", sa.String(128), nullable=False),
            sa.Column("vendor", sa.String(255), nullable=True),
            sa.Column("qty_requested", sa.Float(), nullable=False),
            sa.Column("estimated_unit_cost", sa.Float(), nullable=True),
            sa.Column("estimated_cost", sa.Float(), nullable=True),
        )
        ah.safe_create_index(
            op, conn, "ix_material_request_draft_items_draft_id", "material_request_draft_items", ["draft_id"]
        )


def downgrade() -> None:
    conn = op.get_bind()
    for table in (
        "material_request_draft_items",
        "material_request_drafts",
        "material_request_queue",
    ):
        if ah.table_exists(conn, table):
            ah.safe_drop_table(op, conn, table)
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_drop_column(op, conn, "inventory_items", "maximum_qty")
