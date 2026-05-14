"""Pulse routines: templates, checklist items, and execution archive."""
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
revision = '0101_pulse_routines'
down_revision = '0100_procedure_search_keywords'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_routines', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('zone_id', UUID(as_uuid=False), nullable=True), sa.Column('created_by_user_id', UUID(as_uuid=False), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ondelete='SET NULL'), sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routines_company_id', 'pulse_routines', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routines_zone_id', 'pulse_routines', ['zone_id'])
    ah.safe_create_table(op, conn, 'pulse_routine_items', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_id', UUID(as_uuid=False), nullable=False), sa.Column('label', sa.String(length=8000), nullable=False), sa.Column('position', sa.Integer(), nullable=False), sa.Column('required', sa.Boolean(), nullable=False, server_default=sa.text('true')), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_id'], ['pulse_routines.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_items_company_id', 'pulse_routine_items', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_items_routine_id', 'pulse_routine_items', ['routine_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_items_routine_id_position', 'pulse_routine_items', ['routine_id', 'position'])
    ah.safe_create_table(op, conn, 'pulse_routine_runs', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_id', UUID(as_uuid=False), nullable=False), sa.Column('user_id', UUID(as_uuid=False), nullable=True), sa.Column('shift_id', UUID(as_uuid=False), nullable=True), sa.Column('started_at', sa.DateTime(timezone=True), nullable=False), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('status', sa.String(length=32), nullable=False, server_default='in_progress'), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_id'], ['pulse_routines.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'), sa.CheckConstraint("status in ('in_progress','completed')", name='ck_pulse_routine_runs_status'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_runs_company_id', 'pulse_routine_runs', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_runs_routine_id_completed_at', 'pulse_routine_runs', ['routine_id', 'completed_at'])
    ah.safe_create_table(op, conn, 'pulse_routine_item_runs', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_run_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_item_id', UUID(as_uuid=False), nullable=True), sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('false')), sa.Column('note', sa.Text(), nullable=True), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_run_id'], ['pulse_routine_runs.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_item_id'], ['pulse_routine_items.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_item_runs_company_id', 'pulse_routine_item_runs', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_item_runs_routine_run_id', 'pulse_routine_item_runs', ['routine_run_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_item_runs_routine_run_id', 'pulse_routine_item_runs')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_item_runs_company_id', 'pulse_routine_item_runs')
    ah.safe_drop_table(op, conn, 'pulse_routine_item_runs')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_runs_routine_id_completed_at', 'pulse_routine_runs')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_runs_company_id', 'pulse_routine_runs')
    ah.safe_drop_table(op, conn, 'pulse_routine_runs')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_items_routine_id_position', 'pulse_routine_items')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_items_routine_id', 'pulse_routine_items')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_items_company_id', 'pulse_routine_items')
    ah.safe_drop_table(op, conn, 'pulse_routine_items')
    ah.safe_drop_index(op, conn, 'ix_pulse_routines_zone_id', 'pulse_routines')
    ah.safe_drop_index(op, conn, 'ix_pulse_routines_company_id', 'pulse_routines')
    ah.safe_drop_table(op, conn, 'pulse_routines')
