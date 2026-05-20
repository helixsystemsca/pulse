"""project activity log + hidden project fields

Revision ID: 0083_prj_activity
Revises: 0082_onboarding_tiered_progress
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
revision = '0083_prj_activity'
down_revision = '0082_onboarding_tiered_progress'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('goal', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('notes', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('success_definition', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('current_phase', sa.String(32), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('summary', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('metrics', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('lessons_learned', sa.Text(), nullable=True))
    ah.safe_create_table(op, conn, 'pulse_project_activity', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=False), sa.Column('type', sa.String(16), nullable=False), sa.Column('title', sa.String(255), nullable=True), sa.Column('description', sa.Text(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False))
    ah.safe_create_index(op, conn, 'ix_pulse_project_activity_project_id', 'pulse_project_activity', ['project_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_activity_type', 'pulse_project_activity', ['type'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_activity_created_at', 'pulse_project_activity', ['created_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_activity_created_at', 'pulse_project_activity')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_activity_type', 'pulse_project_activity')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_activity_project_id', 'pulse_project_activity')
    ah.safe_drop_table(op, conn, 'pulse_project_activity')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'lessons_learned')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'metrics')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'summary')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'current_phase')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'success_definition')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'notes')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'goal')
