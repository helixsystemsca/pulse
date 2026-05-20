"""Add department_slug to inventory vendors and contractors."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1009_inventory_vendor_contractor_department"
down_revision = "1008_schedule_department_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "inventory_vendors",
        sa.Column("department_slug", sa.String(64), nullable=False, server_default="maintenance"),
    )
    ah.safe_add_column(
        op,
        conn,
        "inventory_contractors",
        sa.Column("department_slug", sa.String(64), nullable=False, server_default="maintenance"),
    )
    ah.safe_create_index(op, conn, "ix_inventory_vendors_department_slug", "inventory_vendors", ["department_slug"])
    ah.safe_create_index(
        op, conn, "ix_inventory_contractors_department_slug", "inventory_contractors", ["department_slug"]
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_inventory_contractors_department_slug", "inventory_contractors")
    ah.safe_drop_index(op, conn, "ix_inventory_vendors_department_slug", "inventory_vendors")
    ah.safe_drop_column(op, conn, "inventory_contractors", "department_slug")
    ah.safe_drop_column(op, conn, "inventory_vendors", "department_slug")
