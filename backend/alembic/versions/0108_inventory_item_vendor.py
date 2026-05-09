"""Inventory items: optional vendor name."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0108_inventory_item_vendor"
down_revision = "0107_routine_item_procedure_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory_items", sa.Column("vendor", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("inventory_items", "vendor")
