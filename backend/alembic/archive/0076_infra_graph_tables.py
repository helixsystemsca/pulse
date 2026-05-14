"""Infrastructure map graph tables

Revision ID: 0076_infra_graph_tables
Revises: 0075_wr_pm_indexes
Create Date: 2026-05-01
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import UUID
revision = '0076_infra_graph_tables'
down_revision = '0075_wr_pm_indexes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'infra_assets', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(length=255), nullable=False, server_default=''), sa.Column('asset_type', sa.String(length=64), nullable=False, server_default='asset'), sa.Column('system_type', sa.String(length=32), nullable=False, server_default='telemetry'), sa.Column('x', sa.Float(), nullable=False, server_default='0'), sa.Column('y', sa.Float(), nullable=False, server_default='0'), sa.Column('notes', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_infra_assets_company', 'infra_assets', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_infra_assets_system', 'infra_assets', ['company_id', 'system_type'])
    ah.safe_create_table(op, conn, 'infra_connections', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('from_asset_id', UUID(as_uuid=False), sa.ForeignKey('infra_assets.id', ondelete='CASCADE'), nullable=False), sa.Column('to_asset_id', UUID(as_uuid=False), sa.ForeignKey('infra_assets.id', ondelete='CASCADE'), nullable=False), sa.Column('system_type', sa.String(length=32), nullable=False, server_default='telemetry'), sa.Column('connection_type', sa.String(length=32), nullable=False, server_default='link'), sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_infra_conn_company', 'infra_connections', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_infra_conn_system', 'infra_connections', ['company_id', 'system_type'])
    ah.safe_create_index(op, conn, 'ix_infra_conn_from', 'infra_connections', ['company_id', 'from_asset_id'])
    ah.safe_create_index(op, conn, 'ix_infra_conn_to', 'infra_connections', ['company_id', 'to_asset_id'])
    ah.safe_create_table(op, conn, 'infra_attributes', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('entity_type', sa.String(length=16), nullable=False), sa.Column('entity_id', UUID(as_uuid=False), nullable=False), sa.Column('key', sa.String(length=80), nullable=False), sa.Column('value', sa.Text(), nullable=False, server_default=''), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_infra_attr_company', 'infra_attributes', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_infra_attr_entity', 'infra_attributes', ['company_id', 'entity_type', 'entity_id'])
    ah.safe_create_index(op, conn, 'ix_infra_attr_key', 'infra_attributes', ['company_id', 'key'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_infra_attr_key', 'infra_attributes')
    ah.safe_drop_index(op, conn, 'ix_infra_attr_entity', 'infra_attributes')
    ah.safe_drop_index(op, conn, 'ix_infra_attr_company', 'infra_attributes')
    ah.safe_drop_table(op, conn, 'infra_attributes')
    ah.safe_drop_index(op, conn, 'ix_infra_conn_to', 'infra_connections')
    ah.safe_drop_index(op, conn, 'ix_infra_conn_from', 'infra_connections')
    ah.safe_drop_index(op, conn, 'ix_infra_conn_system', 'infra_connections')
    ah.safe_drop_index(op, conn, 'ix_infra_conn_company', 'infra_connections')
    ah.safe_drop_table(op, conn, 'infra_connections')
    ah.safe_drop_index(op, conn, 'ix_infra_assets_system', 'infra_assets')
    ah.safe_drop_index(op, conn, 'ix_infra_assets_company', 'infra_assets')
    ah.safe_drop_table(op, conn, 'infra_assets')
