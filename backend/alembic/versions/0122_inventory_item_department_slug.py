"""Owning department slug for inventory items (workspace / org chart)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0122_inventory_item_department_slug"
down_revision = "0121_pulse_worker_hr_department_slugs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("department_slug", sa.String(length=32), nullable=False, server_default="maintenance"),
    )
    op.create_index(
        "ix_inventory_items_company_department_slug",
        "inventory_items",
        ["company_id", "department_slug"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_items_company_department_slug", table_name="inventory_items")
    op.drop_column("inventory_items", "department_slug")
