"""Operational XP extensions: ledger categories, profile counters, achievements metadata, peer recognitions, tenant config."""
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
revision = '0113_operational_xp_recognition'
down_revision = '0112_proc_worker_completions'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    ah.safe_add_column(op, bind, 'xp_ledger', sa.Column('category', sa.String(length=32), nullable=True))
    ah.safe_add_column(op, bind, 'xp_ledger', sa.Column('source_type', sa.String(length=64), nullable=True))
    ah.safe_add_column(op, bind, 'xp_ledger', sa.Column('source_id', sa.String(length=64), nullable=True))
    ah.safe_create_index(op, bind, 'ix_xp_ledger_company_category_created', 'xp_ledger', ['company_id', 'category', 'created_at'])
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('current_title', sa.String(length=128), nullable=True))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('professional_level', sa.Integer(), nullable=False, server_default=sa.text('1')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('attendance_shift_streak', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('perfect_weeks', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('procedures_completed', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('recognitions_received', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('pm_completed', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('work_orders_completed', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('routines_completed', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'user_stats', sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_add_column(op, bind, 'badge_definitions', sa.Column('stable_key', sa.String(length=64), nullable=True))
    ah.safe_add_column(op, bind, 'badge_definitions', sa.Column('rarity', sa.String(length=32), nullable=False, server_default=sa.text("'common'")))
    ah.safe_add_column(op, bind, 'badge_definitions', sa.Column('xp_reward', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, bind, 'badge_definitions', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_create_index(op, bind, 'ix_badge_definitions_stable_key', 'badge_definitions', ['stable_key'], unique=True)
    op.execute(text('UPDATE badge_definitions SET stable_key = id WHERE stable_key IS NULL'))
    ah.safe_create_table(op, bind, 'pulse_worker_recognitions', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('from_worker_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('to_worker_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('from_department', sa.String(length=128), nullable=True), sa.Column('to_department', sa.String(length=128), nullable=True), sa.Column('recognition_type', sa.String(length=32), nullable=False), sa.Column('comment', sa.Text(), nullable=False), sa.Column('status', sa.String(length=16), nullable=False, server_default=sa.text("'approved'")), sa.Column('approved_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, bind, 'ix_pulse_worker_recognitions_company', 'pulse_worker_recognitions', ['company_id'])
    ah.safe_create_index(op, bind, 'ix_pulse_worker_recognitions_to', 'pulse_worker_recognitions', ['to_worker_id', 'created_at'])
    ah.safe_create_index(op, bind, 'ix_pulse_worker_recognitions_from', 'pulse_worker_recognitions', ['from_worker_id', 'created_at'])
    ah.safe_create_table(op, bind, 'pulse_xp_operator_config', sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True), sa.Column('recognition_requires_approval', sa.Boolean(), nullable=False, server_default=sa.text('false')), sa.Column('recognition_monthly_limit_per_user', sa.Integer(), nullable=False, server_default=sa.text('12')), sa.Column('recognition_max_per_target_per_month', sa.Integer(), nullable=False, server_default=sa.text('4')), sa.Column('category_daily_xp_caps', JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('professional_level_thresholds', JSONB(), nullable=True), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    badges = [('reliability_shifts_10', '10-Shift Reliability', 'Complete 10 consecutive scheduled shifts with attendance credit.', 'calendar-check', 'attendance', 'shift_streak_10', 'uncommon', 0), ('reliability_shifts_20', '20-Shift Reliability', 'Complete 20 consecutive scheduled shifts with attendance credit.', 'calendar-check', 'attendance', 'shift_streak_20', 'rare', 0), ('reliability_shifts_30', '30-Shift Reliability', 'Complete 30 consecutive scheduled shifts with attendance credit.', 'calendar-check', 'attendance', 'shift_streak_30', 'rare', 0), ('ach_fully_certified', 'Fully Certified', 'Maintain active completion across all assigned routines training.', 'badge-check', 'compliance', 'fully_certified', 'epic', 50), ('ach_cross_trained', 'Cross-Trained', 'Complete optional cross-training assignments across multiple areas.', 'shuffle', 'compliance', 'cross_trained', 'rare', 40), ('ach_safety_focused', 'Safety Focused', 'Consistently complete high-risk procedures with verification on time.', 'shield', 'compliance', 'safety_focused', 'uncommon', 35), ('ach_procedure_specialist', 'Procedure Specialist', 'Demonstrate depth across procedure completions and quality signals.', 'file-text', 'compliance', 'procedure_specialist', 'uncommon', 30)]
    ins = text('INSERT INTO badge_definitions (id, name, description, icon_key, category, stable_key, rarity, xp_reward, is_active) VALUES (:id, :name, :description, :icon_key, :category, :stable_key, :rarity, :xp_reward, true) ON CONFLICT (id) DO NOTHING')
    for bid, name, desc, icon, cat, sk, rarity, xpr in badges:
        bind.execute(ins, {'id': bid, 'name': name, 'description': desc, 'icon_key': icon, 'category': cat, 'stable_key': sk, 'rarity': rarity, 'xp_reward': xpr})

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, 'pulse_xp_operator_config')
    ah.safe_drop_index(op, conn, 'ix_pulse_worker_recognitions_from', 'pulse_worker_recognitions')
    ah.safe_drop_index(op, conn, 'ix_pulse_worker_recognitions_to', 'pulse_worker_recognitions')
    ah.safe_drop_index(op, conn, 'ix_pulse_worker_recognitions_company', 'pulse_worker_recognitions')
    ah.safe_drop_table(op, conn, 'pulse_worker_recognitions')
    ah.safe_drop_index(op, conn, 'ix_badge_definitions_stable_key', 'badge_definitions')
    ah.safe_drop_column(op, conn, 'badge_definitions', 'is_active')
    ah.safe_drop_column(op, conn, 'badge_definitions', 'xp_reward')
    ah.safe_drop_column(op, conn, 'badge_definitions', 'rarity')
    ah.safe_drop_column(op, conn, 'badge_definitions', 'stable_key')
    ah.safe_drop_column(op, conn, 'user_stats', 'last_activity_at')
    ah.safe_drop_column(op, conn, 'user_stats', 'routines_completed')
    ah.safe_drop_column(op, conn, 'user_stats', 'work_orders_completed')
    ah.safe_drop_column(op, conn, 'user_stats', 'pm_completed')
    ah.safe_drop_column(op, conn, 'user_stats', 'recognitions_received')
    ah.safe_drop_column(op, conn, 'user_stats', 'procedures_completed')
    ah.safe_drop_column(op, conn, 'user_stats', 'perfect_weeks')
    ah.safe_drop_column(op, conn, 'user_stats', 'attendance_shift_streak')
    ah.safe_drop_column(op, conn, 'user_stats', 'professional_level')
    ah.safe_drop_column(op, conn, 'user_stats', 'current_title')
    ah.safe_drop_index(op, conn, 'ix_xp_ledger_company_category_created', 'xp_ledger')
    ah.safe_drop_column(op, conn, 'xp_ledger', 'source_id')
    ah.safe_drop_column(op, conn, 'xp_ledger', 'source_type')
    ah.safe_drop_column(op, conn, 'xp_ledger', 'category')
