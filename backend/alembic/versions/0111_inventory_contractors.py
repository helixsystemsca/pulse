"""Tenant contractor directory for inventory (same shape as vendors)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0111_inventory_contractors"
down_revision = "0110_procedure_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_contractors",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("contact_phone", sa.String(length=64), nullable=True),
        sa.Column("account_number", sa.String(length=128), nullable=True),
        sa.Column("payment_terms", sa.String(length=255), nullable=True),
        sa.Column("item_specialty", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("website", sa.String(length=512), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=True),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("region", sa.String(length=128), nullable=True),
        sa.Column("postal_code", sa.String(length=32), nullable=True),
        sa.Column("country", sa.String(length=128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_contractors_company_id", "inventory_contractors", ["company_id"])
    op.create_index("ix_inventory_contractors_company_name", "inventory_contractors", ["company_id", "name"])


def downgrade() -> None:
    op.drop_index("ix_inventory_contractors_company_name", table_name="inventory_contractors")
    op.drop_index("ix_inventory_contractors_company_id", table_name="inventory_contractors")
    op.drop_table("inventory_contractors")
