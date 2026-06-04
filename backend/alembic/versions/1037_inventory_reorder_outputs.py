"""Reorder package exports table and default reorder_outputs settings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1037_inventory_reorder_outputs"
down_revision = "1036_inventory_replenishment_cycles"
branch_labels = None
depends_on = None

_PROCUREMENT_DEFAULTS = {
    "excel": ["material_requisition"],
    "shopping_list": ["shopping_list"],
    "email": ["email_draft"],
    "erp": ["material_requisition"],
    "manual": ["material_requisition"],
}


def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "reorder_package_exports"):
        ah.safe_create_table(
            op,
            conn,
            "reorder_package_exports",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_by_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("project", sa.String(255), nullable=False),
            sa.Column("location", sa.String(512), nullable=False),
            sa.Column("cost_object", sa.String(255), nullable=True),
            sa.Column("comments", sa.Text(), nullable=True),
            sa.Column("item_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("outputs", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_reorder_package_exports_company_id",
            "reorder_package_exports",
            ["company_id"],
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_reorder_package_exports_created_at",
            "reorder_package_exports",
            ["created_at"],
        )

    if not ah.table_exists(conn, "inventory_module_settings"):
        return

    rows = conn.execute(
        sa.text("SELECT id, settings FROM inventory_module_settings")
    ).fetchall()
    for row_id, settings in rows:
        if not isinstance(settings, dict):
            continue
        inv = settings.get("inventory")
        if not isinstance(inv, dict):
            inv = {}
        if inv.get("reorder_outputs"):
            continue
        mode = str(inv.get("procurement_mode") or "excel").strip().lower()
        outputs = _PROCUREMENT_DEFAULTS.get(mode, ["material_requisition"])
        inv = dict(inv)
        inv["reorder_outputs"] = outputs
        settings = dict(settings)
        settings["inventory"] = inv
        conn.execute(
            sa.text(
                "UPDATE inventory_module_settings SET settings = CAST(:settings AS jsonb) WHERE id = :id"
            ),
            {"id": row_id, "settings": json.dumps(settings)},
        )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, "reorder_package_exports")
