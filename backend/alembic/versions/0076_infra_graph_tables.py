"""Infrastructure map graph tables

Revision ID: 0076_infra_graph_tables
Revises: 0075_wr_pm_indexes
Create Date: 2026-05-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0076_infra_graph_tables"
down_revision = "0075_wr_pm_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "infra_assets",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("asset_type", sa.String(length=64), nullable=False, server_default="asset"),
        sa.Column("system_type", sa.String(length=32), nullable=False, server_default="telemetry"),
        sa.Column("x", sa.Float(), nullable=False, server_default="0"),
        sa.Column("y", sa.Float(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_infra_assets_company", "infra_assets", ["company_id"])
    op.create_index("ix_infra_assets_system", "infra_assets", ["company_id", "system_type"])

    op.create_table(
        "infra_connections",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_asset_id", UUID(as_uuid=False), sa.ForeignKey("infra_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_asset_id", UUID(as_uuid=False), sa.ForeignKey("infra_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("system_type", sa.String(length=32), nullable=False, server_default="telemetry"),
        sa.Column("connection_type", sa.String(length=32), nullable=False, server_default="link"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_infra_conn_company", "infra_connections", ["company_id"])
    op.create_index("ix_infra_conn_system", "infra_connections", ["company_id", "system_type"])
    op.create_index("ix_infra_conn_from", "infra_connections", ["company_id", "from_asset_id"])
    op.create_index("ix_infra_conn_to", "infra_connections", ["company_id", "to_asset_id"])

    op.create_table(
        "infra_attributes",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(length=16), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=False), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_infra_attr_company", "infra_attributes", ["company_id"])
    op.create_index("ix_infra_attr_entity", "infra_attributes", ["company_id", "entity_type", "entity_id"])
    op.create_index("ix_infra_attr_key", "infra_attributes", ["company_id", "key"])


def downgrade() -> None:
    op.drop_index("ix_infra_attr_key", table_name="infra_attributes")
    op.drop_index("ix_infra_attr_entity", table_name="infra_attributes")
    op.drop_index("ix_infra_attr_company", table_name="infra_attributes")
    op.drop_table("infra_attributes")

    op.drop_index("ix_infra_conn_to", table_name="infra_connections")
    op.drop_index("ix_infra_conn_from", table_name="infra_connections")
    op.drop_index("ix_infra_conn_system", table_name="infra_connections")
    op.drop_index("ix_infra_conn_company", table_name="infra_connections")
    op.drop_table("infra_connections")

    op.drop_index("ix_infra_assets_system", table_name="infra_assets")
    op.drop_index("ix_infra_assets_company", table_name="infra_assets")
    op.drop_table("infra_assets")

