"""Tenant blueprints and blueprint elements."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blueprints",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_blueprints_company_id", "blueprints", ["company_id"])

    op.create_table(
        "blueprint_elements",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "blueprint_id",
            UUID(as_uuid=False),
            sa.ForeignKey("blueprints.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("element_type", sa.String(16), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
        sa.Column("rotation", sa.Float(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column(
            "linked_device_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "assigned_zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("device_kind", sa.String(32), nullable=True),
    )
    op.create_index("ix_blueprint_elements_blueprint_id", "blueprint_elements", ["blueprint_id"])
    op.create_index("ix_blueprint_elements_linked_device_id", "blueprint_elements", ["linked_device_id"])
    op.create_index("ix_blueprint_elements_assigned_zone_id", "blueprint_elements", ["assigned_zone_id"])


def downgrade() -> None:
    op.drop_index("ix_blueprint_elements_assigned_zone_id", table_name="blueprint_elements")
    op.drop_index("ix_blueprint_elements_linked_device_id", table_name="blueprint_elements")
    op.drop_index("ix_blueprint_elements_blueprint_id", table_name="blueprint_elements")
    op.drop_table("blueprint_elements")
    op.drop_index("ix_blueprints_company_id", table_name="blueprints")
    op.drop_table("blueprints")
