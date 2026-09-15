"""Inventory + sub-asset links onto recreation ops facilities.

ops_facility_id already exists on facility_equipment (1052). This adds the same
link on inventory_items, plus parent_equipment_id for child equipment. RLS is
already on both tables (company_id).
"""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1055_facility_links"
down_revision = "1054_reg_source_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_add_column(
        op,
        conn,
        "inventory_items",
        sa.Column(
            "ops_facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_create_index(
        op, conn, "ix_inventory_items_ops_facility_id", "inventory_items", ["ops_facility_id"]
    )

    ah.safe_add_column(
        op,
        conn,
        "facility_equipment",
        sa.Column(
            "parent_equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_facility_equipment_parent_equipment_id",
        "facility_equipment",
        ["parent_equipment_id"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(
        op, conn, "ix_facility_equipment_parent_equipment_id", "facility_equipment"
    )
    ah.safe_drop_column(op, conn, "facility_equipment", "parent_equipment_id")
    ah.safe_drop_index(op, conn, "ix_inventory_items_ops_facility_id", "inventory_items")
    ah.safe_drop_column(op, conn, "inventory_items", "ops_facility_id")
