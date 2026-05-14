"""Equipment parts master list, equipment/part images, work request part_id."""
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
revision = '0032'
down_revision = '0031'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'facility_equipment', sa.Column('image_url', sa.String(length=2048), nullable=True))
    ah.safe_create_table(op, conn, 'equipment_parts', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('equipment_id', UUID(as_uuid=False), sa.ForeignKey('facility_equipment.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'), sa.Column('replacement_interval_days', sa.Integer(), nullable=True), sa.Column('last_replaced_date', sa.Date(), nullable=True), sa.Column('next_replacement_date', sa.Date(), nullable=True), sa.Column('notes', sa.Text(), nullable=True), sa.Column('image_url', sa.String(length=2048), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, conn, 'ix_equipment_parts_company_id', 'equipment_parts', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_equipment_parts_equipment_id', 'equipment_parts', ['equipment_id'])
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('part_id', UUID(as_uuid=False), sa.ForeignKey('equipment_parts.id', ondelete='SET NULL'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_part_id', 'pulse_work_requests', ['part_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_part_id', 'pulse_work_requests')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'part_id')
    ah.safe_drop_index(op, conn, 'ix_equipment_parts_equipment_id', 'equipment_parts')
    ah.safe_drop_index(op, conn, 'ix_equipment_parts_company_id', 'equipment_parts')
    ah.safe_drop_table(op, conn, 'equipment_parts')
    ah.safe_drop_column(op, conn, 'facility_equipment', 'image_url')
