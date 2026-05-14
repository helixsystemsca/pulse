"""XP ledger (idempotent grants) + per-role XP totals on user_stats."""
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
revision = '0064_xp_ledger_role_tracks'
down_revision = '0063_gamified_tasks_xp'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'user_stats', sa.Column('xp_worker', sa.Integer(), nullable=False, server_default='0'))
    ah.safe_add_column(op, conn, 'user_stats', sa.Column('xp_lead', sa.Integer(), nullable=False, server_default='0'))
    ah.safe_add_column(op, conn, 'user_stats', sa.Column('xp_supervisor', sa.Integer(), nullable=False, server_default='0'))
    op.execute('UPDATE user_stats SET xp_worker = total_xp WHERE total_xp > 0 AND xp_worker = 0')
    ah.safe_create_table(op, conn, 'xp_ledger', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('track', sa.String(length=32), nullable=False), sa.Column('reason_code', sa.String(length=64), nullable=False), sa.Column('dedupe_key', sa.String(length=512), nullable=False), sa.Column('xp_delta', sa.Integer(), nullable=False), sa.Column('meta', JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')), sa.CheckConstraint('xp_delta > 0', name='ck_xp_ledger_delta_pos'), sa.CheckConstraint("track IN ('worker','lead','supervisor')", name='ck_xp_ledger_track'), sa.UniqueConstraint('user_id', 'dedupe_key', name='uq_xp_ledger_user_dedupe'))
    ah.safe_create_index(op, conn, 'ix_xp_ledger_company_id', 'xp_ledger', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_xp_ledger_user_id', 'xp_ledger', ['user_id'])
    ah.safe_create_index(op, conn, 'ix_xp_ledger_created_at', 'xp_ledger', ['created_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_xp_ledger_created_at', 'xp_ledger')
    ah.safe_drop_index(op, conn, 'ix_xp_ledger_user_id', 'xp_ledger')
    ah.safe_drop_index(op, conn, 'ix_xp_ledger_company_id', 'xp_ledger')
    ah.safe_drop_table(op, conn, 'xp_ledger')
    ah.safe_drop_column(op, conn, 'user_stats', 'xp_supervisor')
    ah.safe_drop_column(op, conn, 'user_stats', 'xp_lead')
    ah.safe_drop_column(op, conn, 'user_stats', 'xp_worker')
