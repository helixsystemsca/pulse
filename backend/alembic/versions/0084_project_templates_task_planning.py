"""project templates + task planning metadata + activity enrichment

Revision ID: 0084_prj_templates
Revises: 0083_prj_activity
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
revision = '0084_prj_templates'
down_revision = '0083_prj_activity'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_project_templates', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('default_goal', sa.Text(), nullable=True), sa.Column('default_notes', sa.Text(), nullable=True), sa.Column('default_success_definition', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_project_templates_company_id', 'pulse_project_templates', ['company_id'])
    ah.safe_create_table(op, conn, 'pulse_project_template_tasks', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('template_id', UUID(as_uuid=False), sa.ForeignKey('pulse_project_templates.id', ondelete='CASCADE'), nullable=False), sa.Column('title', sa.String(512), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('suggested_duration', sa.String(64), nullable=True), sa.Column('skill_type', sa.String(128), nullable=True), sa.Column('material_notes', sa.Text(), nullable=True), sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'), sa.Column('phase_group', sa.String(128), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_project_template_tasks_template_id', 'pulse_project_template_tasks', ['template_id'])
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('estimated_duration', sa.String(64), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('skill_type', sa.String(128), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('material_notes', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('phase_group', sa.String(128), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('planned_start_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('planned_end_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_phase_group', 'pulse_project_tasks', ['phase_group'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_planned_start_at', 'pulse_project_tasks', ['planned_start_at'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_planned_end_at', 'pulse_project_tasks', ['planned_end_at'])
    ah.safe_add_column(op, conn, 'pulse_project_activity', sa.Column('impact_level', sa.String(16), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_activity', sa.Column('related_task_id', UUID(as_uuid=False), sa.ForeignKey('pulse_project_tasks.id', ondelete='SET NULL'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_project_activity_related_task_id', 'pulse_project_activity', ['related_task_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_activity_related_task_id', 'pulse_project_activity')
    ah.safe_drop_column(op, conn, 'pulse_project_activity', 'related_task_id')
    ah.safe_drop_column(op, conn, 'pulse_project_activity', 'impact_level')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_planned_end_at', 'pulse_project_tasks')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_planned_start_at', 'pulse_project_tasks')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_phase_group', 'pulse_project_tasks')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'planned_end_at')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'planned_start_at')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'phase_group')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'material_notes')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'skill_type')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'estimated_duration')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_template_tasks_template_id', 'pulse_project_template_tasks')
    ah.safe_drop_table(op, conn, 'pulse_project_template_tasks')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_templates_company_id', 'pulse_project_templates')
    ah.safe_drop_table(op, conn, 'pulse_project_templates')
