"""Add department_slug to inventory vendors and contractors."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1009_inventory_vendor_contractor_department"
down_revision = "1008_schedule_department_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_vendors",
        sa.Column("department_slug", sa.String(64), nullable=False, server_default="maintenance"),
    )
    op.add_column(
        "inventory_contractors",
        sa.Column("department_slug", sa.String(64), nullable=False, server_default="maintenance"),
    )
    op.create_index("ix_inventory_vendors_department_slug", "inventory_vendors", ["department_slug"])
    op.create_index("ix_inventory_contractors_department_slug", "inventory_contractors", ["department_slug"])


def downgrade() -> None:
    op.drop_index("ix_inventory_contractors_department_slug", table_name="inventory_contractors")
    op.drop_index("ix_inventory_vendors_department_slug", table_name="inventory_vendors")
    op.drop_column("inventory_contractors", "department_slug")
    op.drop_column("inventory_vendors", "department_slug")
