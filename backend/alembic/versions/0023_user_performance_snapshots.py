"""Pulse: optional cache table for per-user performance metrics."""
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
revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_user_performance_snapshots', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('time_window', sa.String(16), nullable=False), sa.Column('metrics_json', JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.UniqueConstraint('user_id', 'company_id', 'time_window', name='uq_pulse_perf_snap_user_company_window'))
    ah.safe_create_index(op, conn, 'ix_pulse_perf_snap_company_window', 'pulse_user_performance_snapshots', ['company_id', 'time_window'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_perf_snap_company_window', 'pulse_user_performance_snapshots')
    ah.safe_drop_table(op, conn, 'pulse_user_performance_snapshots')
