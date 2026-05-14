"""Facility equipment registry (tenant-scoped)."""
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
revision = '0030'
down_revision = '0029'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'facility_equipment', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('type', sa.String(128), nullable=False, server_default='General'), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True), sa.Column('status', sa.String(32), nullable=False, server_default='active'), sa.Column('manufacturer', sa.String(255), nullable=True), sa.Column('model', sa.String(255), nullable=True), sa.Column('serial_number', sa.String(255), nullable=True), sa.Column('installation_date', sa.Date(), nullable=True), sa.Column('last_service_date', sa.Date(), nullable=True), sa.Column('notes', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_facility_equipment_company_id', 'facility_equipment', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_facility_equipment_zone_id', 'facility_equipment', ['zone_id'])
    ah.safe_create_index(op, conn, 'ix_facility_equipment_status', 'facility_equipment', ['status'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_facility_equipment_status', 'facility_equipment')
    ah.safe_drop_index(op, conn, 'ix_facility_equipment_zone_id', 'facility_equipment')
    ah.safe_drop_index(op, conn, 'ix_facility_equipment_company_id', 'facility_equipment')
    ah.safe_drop_table(op, conn, 'facility_equipment')
