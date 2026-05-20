"""UserStats.streaks JSONB for daily_activity, pm_on_time, no_flags, shift_attendance.

Revision ID: 0079_named_streaks
Revises: 0078_sched_p2
Create Date: 2026-04-27
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

from sqlalchemy.dialects.postgresql import JSONB
revision = '0079_named_streaks'
down_revision = '0078_sched_p2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'user_stats', sa.Column('streaks', JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'user_stats', 'streaks')
