"""Equipment maintenance fields + work order equipment_id FK."""
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
revision = '0031'
down_revision = '0030'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'facility_equipment', sa.Column('next_service_date', sa.Date(), nullable=True))
    ah.safe_add_column(op, conn, 'facility_equipment', sa.Column('service_interval_days', sa.Integer(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('equipment_id', UUID(as_uuid=False), sa.ForeignKey('facility_equipment.id', ondelete='SET NULL'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_equipment_id', 'pulse_work_requests', ['equipment_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_equipment_id', 'pulse_work_requests')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'equipment_id')
    ah.safe_drop_column(op, conn, 'facility_equipment', 'service_interval_days')
    ah.safe_drop_column(op, conn, 'facility_equipment', 'next_service_date')
