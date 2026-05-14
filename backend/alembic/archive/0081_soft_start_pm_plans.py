"""soft start pm plans

Revision ID: 0081_soft_start_pm_plans
Revises: 0080_g5_badges
Create Date: 2026-04-28
"""
from __future__ import annotations
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = '0081_soft_start_pm_plans'
down_revision = '0080_g5_badges'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_pm_plans', sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('title', sa.String(length=255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('frequency', sa.String(length=16), nullable=False), sa.Column('custom_interval_days', sa.Integer(), nullable=True), sa.Column('start_date', sa.Date(), nullable=False), sa.Column('due_time_offset_days', sa.Integer(), nullable=True), sa.Column('assigned_user_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('equipment_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('facility_equipment.id', ondelete='SET NULL'), nullable=True), sa.Column('template_id', sa.String(length=128), nullable=True), sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('last_generated_at', sa.DateTime(timezone=True), nullable=True), sa.Column('next_due_at', sa.DateTime(timezone=True), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_company_id', 'pulse_pm_plans', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_start_date', 'pulse_pm_plans', ['start_date'])
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_next_due_at', 'pulse_pm_plans', ['next_due_at'])
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_assigned_user_id', 'pulse_pm_plans', ['assigned_user_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_equipment_id', 'pulse_pm_plans', ['equipment_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_pm_plans_template_id', 'pulse_pm_plans', ['template_id'])
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('pm_plan_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('pulse_pm_plans.id', ondelete='SET NULL'), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('work_request_kind', sa.String(length=64), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_pm_plan_id', 'pulse_work_requests', ['pm_plan_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_work_request_kind', 'pulse_work_requests', ['work_request_kind'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_work_request_kind', 'pulse_work_requests')
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_pm_plan_id', 'pulse_work_requests')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'work_request_kind')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'pm_plan_id')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_template_id', 'pulse_pm_plans')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_equipment_id', 'pulse_pm_plans')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_assigned_user_id', 'pulse_pm_plans')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_next_due_at', 'pulse_pm_plans')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_start_date', 'pulse_pm_plans')
    ah.safe_drop_index(op, conn, 'ix_pulse_pm_plans_company_id', 'pulse_pm_plans')
    ah.safe_drop_table(op, conn, 'pulse_pm_plans')
