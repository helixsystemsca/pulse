"""project notification settings + task equipment links

Revision ID: 0091_prj_notify_eq
Revises: 0090_prj_completed_at
Create Date: 2026-04-30
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
revision = '0091_prj_notify_eq'
down_revision = '0090_prj_completed_at'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_material_days', sa.Integer(), nullable=False, server_default='30'))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_equipment_days', sa.Integer(), nullable=False, server_default='7'))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_to_supervision', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_to_lead', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notification_to_owner', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_create_table(op, conn, 'pulse_project_task_equipment', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=False), sa.Column('task_id', UUID(as_uuid=False), sa.ForeignKey('pulse_project_tasks.id', ondelete='CASCADE'), nullable=False), sa.Column('facility_equipment_id', UUID(as_uuid=False), sa.ForeignKey('facility_equipment.id', ondelete='SET NULL'), nullable=True), sa.Column('name', sa.String(255), nullable=False), sa.Column('notes', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_equipment_company_id', 'pulse_project_task_equipment', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_equipment_project_id', 'pulse_project_task_equipment', ['project_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_equipment_task_id', 'pulse_project_task_equipment', ['task_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_equipment_facility_equipment_id', 'pulse_project_task_equipment', ['facility_equipment_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_equipment_facility_equipment_id', 'pulse_project_task_equipment')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_equipment_task_id', 'pulse_project_task_equipment')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_equipment_project_id', 'pulse_project_task_equipment')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_equipment_company_id', 'pulse_project_task_equipment')
    ah.safe_drop_table(op, conn, 'pulse_project_task_equipment')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_to_owner')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_to_lead')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_to_supervision')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_equipment_days')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_material_days')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notification_enabled')
