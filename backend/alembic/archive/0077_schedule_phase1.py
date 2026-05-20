"""Schedule Phase 1 foundation tables + shift extensions

Revision ID: 0077_sched_p1
Revises: 0076_shift_facility
Create Date: 2026-04-26
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

from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0077_sched_p1'
down_revision = '0076_shift_facility'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_schedule_shift_definitions', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('code', sa.String(length=16), nullable=False), sa.Column('name', sa.String(length=128), nullable=True), sa.Column('start_min', sa.Integer(), nullable=False), sa.Column('end_min', sa.Integer(), nullable=False), sa.Column('shift_type', sa.String(length=32), nullable=False, server_default='day'), sa.Column('color', sa.String(length=32), nullable=True), sa.Column('cert_requirements', JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.UniqueConstraint('company_id', 'code', name='uq_sched_shift_def_company_code'), sa.CheckConstraint('start_min >= 0 AND start_min < 1440', name='ck_sched_shift_def_start_min'), sa.CheckConstraint('end_min >= 0 AND end_min < 1440', name='ck_sched_shift_def_end_min'))
    ah.safe_create_index(op, conn, 'ix_sched_shift_def_company_id', 'pulse_schedule_shift_definitions', ['company_id'])
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('shift_definition_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_schedule_shifts_shift_definition_id', 'pulse_schedule_shifts', 'pulse_schedule_shift_definitions', ['shift_definition_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_shift_definition_id', 'pulse_schedule_shifts', ['shift_definition_id'])
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('shift_code', sa.String(length=16), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('is_draft', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_table(op, conn, 'pulse_schedule_periods', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('start_date', sa.Date(), nullable=False), sa.Column('end_date', sa.Date(), nullable=False), sa.Column('availability_deadline', sa.DateTime(timezone=True), nullable=True), sa.Column('publish_deadline', sa.DateTime(timezone=True), nullable=True), sa.Column('status', sa.String(length=32), nullable=False, server_default='draft'), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.CheckConstraint('start_date <= end_date', name='ck_sched_period_dates'))
    ah.safe_create_index(op, conn, 'ix_sched_period_company_id', 'pulse_schedule_periods', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_sched_period_start_date', 'pulse_schedule_periods', ['start_date'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_sched_period_start_date', 'pulse_schedule_periods')
    ah.safe_drop_index(op, conn, 'ix_sched_period_company_id', 'pulse_schedule_periods')
    ah.safe_drop_table(op, conn, 'pulse_schedule_periods')
    ah.safe_drop_column(op, conn, 'pulse_schedule_shifts', 'published_at')
    ah.safe_drop_column(op, conn, 'pulse_schedule_shifts', 'is_draft')
    ah.safe_drop_column(op, conn, 'pulse_schedule_shifts', 'shift_code')
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_shifts_shift_definition_id', 'pulse_schedule_shifts')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_schedule_shifts_shift_definition_id', 'pulse_schedule_shifts', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_schedule_shifts', 'shift_definition_id')
    ah.safe_drop_index(op, conn, 'ix_sched_shift_def_company_id', 'pulse_schedule_shift_definitions')
    ah.safe_drop_table(op, conn, 'pulse_schedule_shift_definitions')
