"""task estimates actuals

Revision ID: 0088_task_estimates_actuals
Revises: 0087_user_pm_feature_flag
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0088_task_estimates_actuals"
down_revision = "0087_user_pm_feature_flag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_project_tasks", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("pulse_project_tasks", sa.Column("estimated_completion_minutes", sa.Integer(), nullable=True))
    op.add_column("pulse_project_tasks", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("pulse_project_tasks", sa.Column("actual_completion_minutes", sa.Integer(), nullable=True))

    op.create_index("ix_pulse_project_tasks_start_date", "pulse_project_tasks", ["start_date"])
    op.create_index("ix_pulse_project_tasks_end_date", "pulse_project_tasks", ["end_date"])


def downgrade() -> None:
    op.drop_index("ix_pulse_project_tasks_end_date", table_name="pulse_project_tasks")
    op.drop_index("ix_pulse_project_tasks_start_date", table_name="pulse_project_tasks")

    op.drop_column("pulse_project_tasks", "actual_completion_minutes")
    op.drop_column("pulse_project_tasks", "end_date")
    op.drop_column("pulse_project_tasks", "estimated_completion_minutes")
    op.drop_column("pulse_project_tasks", "start_date")

