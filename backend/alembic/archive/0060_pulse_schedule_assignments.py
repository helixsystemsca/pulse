"""pulse_schedule_assignments (night shift areas + notes)

Revision ID: 0060_pulse_schedule_assignments
Revises: 0059
Create Date: 2026-04-14
"""
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision = '0060_pulse_schedule_assignments'
down_revision = '0059'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_schedule_assignments', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('date', sa.Date(), nullable=False), sa.Column('shift_type', sa.String(length=32), nullable=False, server_default='night'), sa.Column('area', sa.String(length=128), nullable=False), sa.Column('assigned_user_id', UUID(as_uuid=False), nullable=True), sa.Column('notes', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['assigned_user_id'], ['users.id'], ondelete='SET NULL'), sa.UniqueConstraint('company_id', 'date', 'shift_type', 'area', name='uq_pulse_schedule_assign_area'))
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_assignments_company_id', 'pulse_schedule_assignments', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_assignments_date', 'pulse_schedule_assignments', ['date'])
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_assignments_shift_type', 'pulse_schedule_assignments', ['shift_type'])
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_assignments_assigned_user_id', 'pulse_schedule_assignments', ['assigned_user_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_assignments_assigned_user_id', 'pulse_schedule_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_assignments_shift_type', 'pulse_schedule_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_assignments_date', 'pulse_schedule_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_assignments_company_id', 'pulse_schedule_assignments')
    ah.safe_drop_table(op, conn, 'pulse_schedule_assignments')
