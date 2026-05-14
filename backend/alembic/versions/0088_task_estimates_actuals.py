"""task estimates actuals

Revision ID: 0088_task_estimates_actuals
Revises: 0087_user_pm_feature_flag
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

revision = '0088_task_estimates_actuals'
down_revision = '0087_user_pm_feature_flag'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('start_date', sa.Date(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('estimated_completion_minutes', sa.Integer(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('end_date', sa.Date(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('actual_completion_minutes', sa.Integer(), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_start_date', 'pulse_project_tasks', ['start_date'])
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_end_date', 'pulse_project_tasks', ['end_date'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_end_date', 'pulse_project_tasks')
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_start_date', 'pulse_project_tasks')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'actual_completion_minutes')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'end_date')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'estimated_completion_minutes')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'start_date')
