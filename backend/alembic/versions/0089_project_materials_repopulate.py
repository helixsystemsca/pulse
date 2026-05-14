"""project materials repopulate

Revision ID: 0089_prj_materials_repop
Revises: 0088_task_estimates_actuals
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
revision = '0089_prj_materials_repop'
down_revision = '0088_task_estimates_actuals'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('repopulation_frequency', sa.String(32), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_projects_archived_at', 'pulse_projects', ['archived_at'])
    ah.safe_create_table(op, conn, 'pulse_project_task_materials', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=False), sa.Column('task_id', UUID(as_uuid=False), sa.ForeignKey('pulse_project_tasks.id', ondelete='CASCADE'), nullable=False), sa.Column('inventory_item_id', UUID(as_uuid=False), sa.ForeignKey('inventory_items.id', ondelete='SET NULL'), nullable=True), sa.Column('name', sa.String(255), nullable=False), sa.Column('quantity_required', sa.Float(), nullable=False, server_default='1'), sa.Column('unit', sa.String(32), nullable=True), sa.Column('notes', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_materials_company_id', 'pulse_project_task_materials', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_materials_project_id', 'pulse_project_task_materials', ['project_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_materials_task_id', 'pulse_project_task_materials', ['task_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_task_materials_inventory_item_id', 'pulse_project_task_materials', ['inventory_item_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_materials_inventory_item_id', 'pulse_project_task_materials')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_materials_task_id', 'pulse_project_task_materials')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_materials_project_id', 'pulse_project_task_materials')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_task_materials_company_id', 'pulse_project_task_materials')
    ah.safe_drop_table(op, conn, 'pulse_project_task_materials')
    ah.safe_drop_index(op, conn, 'ix_pulse_projects_archived_at', 'pulse_projects')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'archived_at')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'repopulation_frequency')
