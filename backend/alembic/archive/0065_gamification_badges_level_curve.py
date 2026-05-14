"""Gamification: XP reason text, streak date, avatar borders, badges."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0065_gam_badges_xp'
down_revision = '0064_xp_ledger_role_tracks'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    ah.safe_add_column(op, bind, 'xp_ledger', sa.Column('reason', sa.Text(), nullable=True))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('last_streak_activity_date', sa.Date(), nullable=True))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('avatar_border', sa.String(length=32), nullable=True))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('unlocked_avatar_borders', JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    ah.safe_create_table(op, bind, 'badge_definitions', sa.Column('id', sa.String(length=64), primary_key=True), sa.Column('name', sa.String(length=128), nullable=False), sa.Column('description', sa.Text(), nullable=False), sa.Column('icon_key', sa.String(length=64), nullable=False, server_default='badge'), sa.Column('category', sa.String(length=64), nullable=False))
    ah.safe_create_table(op, bind, 'user_badges', sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True), sa.Column('badge_id', sa.String(length=64), sa.ForeignKey('badge_definitions.id', ondelete='CASCADE'), primary_key=True), sa.Column('unlocked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, bind, 'ix_user_badges_user_id', 'user_badges', ['user_id'])
    badges = [('streak_3', 'Consistent', 'Maintain a 3-day activity streak.', 'flame', 'attendance'), ('streak_7', 'Reliable', 'Maintain a 7-day activity streak.', 'flame', 'attendance'), ('streak_30', 'Unstoppable', 'Maintain a 30-day activity streak.', 'flame', 'attendance'), ('wo_10', 'Getting Started', 'Complete 10 work-order tasks.', 'wrench', 'work_orders'), ('wo_50', 'Workhorse', 'Complete 50 work-order tasks.', 'wrench', 'work_orders'), ('wo_200', 'Machine', 'Complete 200 work-order tasks.', 'wrench', 'work_orders'), ('ontime_10', 'Punctual', 'Complete 10 tasks on time.', 'clock', 'on_time'), ('ontime_50', 'Dependable', 'Complete 50 tasks on time.', 'clock', 'on_time'), ('proc_10', 'Procedure Student', 'Complete 10 procedure-style tasks.', 'list-checks', 'procedures'), ('proc_50', 'Procedure Pro', 'Complete 50 procedure-style tasks.', 'list-checks', 'procedures'), ('insp_10', 'Sharp Eye', 'Earn 10 inspection-related XP events.', 'clipboard-check', 'inspections')]
    ins = text('INSERT INTO badge_definitions (id, name, description, icon_key, category) VALUES (:id, :name, :description, :icon_key, :category) ON CONFLICT (id) DO NOTHING')
    for bid, name, desc, icon, cat in badges:
        bind.execute(ins, {'id': bid, 'name': name, 'description': desc, 'icon_key': icon, 'category': cat})

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_user_badges_user_id', 'user_badges')
    ah.safe_drop_table(op, conn, 'user_badges')
    ah.safe_drop_table(op, conn, 'badge_definitions')
    ah.safe_drop_column(op, conn, 'user_stats', 'unlocked_avatar_borders')
    ah.safe_drop_column(op, conn, 'user_stats', 'avatar_border')
    ah.safe_drop_column(op, conn, 'user_stats', 'last_streak_activity_date')
    ah.safe_drop_column(op, conn, 'xp_ledger', 'reason')
