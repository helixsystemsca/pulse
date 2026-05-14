"""Pulse: work requests, worker profiles, schedule shifts, beacon equipment.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-29

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'pulse_work_requests'):
        return
    ah.safe_create_table(op, conn, 'pulse_work_requests', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('title', sa.String(255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('tool_id', UUID(as_uuid=False), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True), sa.Column('priority', sa.Integer(), nullable=False, server_default='0'), sa.Column('status', sa.String(32), nullable=False, server_default='open'), sa.Column('assigned_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_company_id', 'pulse_work_requests', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_status', 'pulse_work_requests', ['status'])
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_tool_id', 'pulse_work_requests', ['tool_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_assigned_user_id', 'pulse_work_requests', ['assigned_user_id'])
    ah.safe_create_table(op, conn, 'pulse_worker_profiles', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('certifications', JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False), sa.Column('notes', sa.Text(), nullable=True), sa.Column('availability', JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.UniqueConstraint('user_id', name='uq_pulse_worker_profiles_user'))
    ah.safe_create_index(op, conn, 'ix_pulse_worker_profiles_company_id', 'pulse_worker_profiles', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_worker_profiles_user_id', 'pulse_worker_profiles', ['user_id'])
    ah.safe_create_table(op, conn, 'pulse_schedule_shifts', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('assigned_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True), sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False), sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False), sa.Column('shift_type', sa.String(64), nullable=False, server_default='shift'), sa.Column('requires_supervisor', sa.Boolean(), nullable=False, server_default='false'), sa.Column('requires_ticketed', sa.Boolean(), nullable=False, server_default='false'), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_company_id', 'pulse_schedule_shifts', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_assigned_user_id', 'pulse_schedule_shifts', ['assigned_user_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_starts_at', 'pulse_schedule_shifts', ['starts_at'])
    ah.safe_create_table(op, conn, 'pulse_beacon_equipment', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('beacon_id', sa.String(128), nullable=False), sa.Column('tool_id', UUID(as_uuid=False), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True), sa.Column('location_label', sa.String(255), nullable=False, server_default=''), sa.Column('photo_path', sa.String(512), nullable=True), sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.UniqueConstraint('company_id', 'beacon_id', name='uq_pulse_beacon_company_beacon'))
    ah.safe_create_index(op, conn, 'ix_pulse_beacon_equipment_company_id', 'pulse_beacon_equipment', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_beacon_equipment_beacon_id', 'pulse_beacon_equipment', ['beacon_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_beacon_equipment_tool_id', 'pulse_beacon_equipment', ['tool_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, 'pulse_beacon_equipment')
    ah.safe_drop_table(op, conn, 'pulse_schedule_shifts')
    ah.safe_drop_table(op, conn, 'pulse_worker_profiles')
    ah.safe_drop_table(op, conn, 'pulse_work_requests')
