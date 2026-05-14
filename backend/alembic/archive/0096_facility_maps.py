"""Facility maps + map_id on infra graph.

Revision ID: 0096_facility_maps
Revises: 0095_drawings_project_scope
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
revision = '0096_facility_maps'
down_revision = '0095_drawings_project_scope'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'facility_maps', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=True), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('category', sa.String(length=128), nullable=False, server_default='General'), sa.Column('image_url', sa.Text(), nullable=False, server_default=''), sa.Column('elements_json', sa.Text(), nullable=True), sa.Column('tasks_json', sa.Text(), nullable=True), sa.Column('layers_json', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_facility_maps_company', 'facility_maps', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_facility_maps_company_project', 'facility_maps', ['company_id', 'project_id'])
    ah.safe_add_column(op, conn, 'infra_assets', sa.Column('map_id', UUID(as_uuid=False), sa.ForeignKey('facility_maps.id', ondelete='CASCADE'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_infra_assets_map', 'infra_assets', ['company_id', 'map_id'])
    ah.safe_add_column(op, conn, 'infra_connections', sa.Column('map_id', UUID(as_uuid=False), sa.ForeignKey('facility_maps.id', ondelete='CASCADE'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_infra_connections_map', 'infra_connections', ['company_id', 'map_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_infra_connections_map', 'infra_connections')
    ah.safe_drop_column(op, conn, 'infra_connections', 'map_id')
    ah.safe_drop_index(op, conn, 'ix_infra_assets_map', 'infra_assets')
    ah.safe_drop_column(op, conn, 'infra_assets', 'map_id')
    ah.safe_drop_index(op, conn, 'ix_facility_maps_company_project', 'facility_maps')
    ah.safe_drop_index(op, conn, 'ix_facility_maps_company', 'facility_maps')
    ah.safe_drop_table(op, conn, 'facility_maps')
