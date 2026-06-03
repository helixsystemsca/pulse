"""Tenant object storage keys for inventory, branding, and profile photos."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1034_storage_object_keys"
down_revision = "1033_material_request_template_export"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_add_column(
            op, conn, "inventory_items", sa.Column("image_storage_key", sa.String(512), nullable=True)
        )
    if ah.table_exists(conn, "companies"):
        ah.safe_add_column(op, conn, "companies", sa.Column("logo_storage_key", sa.String(512), nullable=True))
        ah.safe_add_column(
            op, conn, "companies", sa.Column("background_storage_key", sa.String(512), nullable=True)
        )
    if ah.table_exists(conn, "users"):
        ah.safe_add_column(op, conn, "users", sa.Column("avatar_storage_key", sa.String(512), nullable=True))
        ah.safe_add_column(
            op, conn, "users", sa.Column("avatar_pending_storage_key", sa.String(512), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "inventory_items"):
        ah.safe_drop_column(op, conn, "inventory_items", "image_storage_key")
    if ah.table_exists(conn, "companies"):
        ah.safe_drop_column(op, conn, "companies", "logo_storage_key")
        ah.safe_drop_column(op, conn, "companies", "background_storage_key")
    if ah.table_exists(conn, "users"):
        ah.safe_drop_column(op, conn, "users", "avatar_storage_key")
        ah.safe_drop_column(op, conn, "users", "avatar_pending_storage_key")
