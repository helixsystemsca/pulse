"""Routine assignments: primary worker, item reassignment, and ad hoc extras."""
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
revision = '0102_routine_assignments_extras'
down_revision = '0101_pulse_routines'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_routine_assignments', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_id', UUID(as_uuid=False), nullable=False), sa.Column('shift_id', UUID(as_uuid=False), nullable=True), sa.Column('date', sa.Date(), nullable=True), sa.Column('primary_user_id', UUID(as_uuid=False), nullable=False), sa.Column('assigned_by_user_id', UUID(as_uuid=False), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_id'], ['pulse_routines.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['primary_user_id'], ['users.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['assigned_by_user_id'], ['users.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_assignments_company_shift', 'pulse_routine_assignments', ['company_id', 'shift_id', 'created_at'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_assignments_primary_user', 'pulse_routine_assignments', ['company_id', 'primary_user_id', 'created_at'])
    ah.safe_create_table(op, conn, 'pulse_routine_item_assignments', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_assignment_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_item_id', UUID(as_uuid=False), nullable=True), sa.Column('assigned_to_user_id', UUID(as_uuid=False), nullable=False), sa.Column('assigned_by_user_id', UUID(as_uuid=False), nullable=True), sa.Column('reason', sa.String(length=64), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_assignment_id'], ['pulse_routine_assignments.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_item_id'], ['pulse_routine_items.id'], ondelete='SET NULL'), sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['assigned_by_user_id'], ['users.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_item_assignments_assignment', 'pulse_routine_item_assignments', ['routine_assignment_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_item_assignments_assigned_to', 'pulse_routine_item_assignments', ['company_id', 'assigned_to_user_id', 'created_at'])
    ah.safe_create_table(op, conn, 'pulse_routine_assignment_extras', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('routine_assignment_id', UUID(as_uuid=False), nullable=False), sa.Column('label', sa.String(length=8000), nullable=False), sa.Column('assigned_to_user_id', UUID(as_uuid=False), nullable=True), sa.Column('created_by_user_id', UUID(as_uuid=False), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('false')), sa.Column('completed_by_user_id', UUID(as_uuid=False), nullable=True), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('note', sa.Text(), nullable=True), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['routine_assignment_id'], ['pulse_routine_assignments.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ondelete='SET NULL'), sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'), sa.ForeignKeyConstraint(['completed_by_user_id'], ['users.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_assignment_extras_assignment', 'pulse_routine_assignment_extras', ['routine_assignment_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_routine_assignment_extras_assigned_to', 'pulse_routine_assignment_extras', ['company_id', 'assigned_to_user_id', 'created_at'])
    ah.safe_add_column(op, conn, 'pulse_routine_runs', sa.Column('routine_assignment_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_routine_runs_assignment_id', 'pulse_routine_runs', 'pulse_routine_assignments', ['routine_assignment_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_routine_runs_assignment_id', 'pulse_routine_runs', ['routine_assignment_id'])
    ah.safe_add_column(op, conn, 'pulse_routine_item_runs', sa.Column('completed_by_user_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_routine_item_runs_completed_by', 'pulse_routine_item_runs', 'users', ['completed_by_user_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(op, conn, 'fk_pulse_routine_item_runs_completed_by', 'pulse_routine_item_runs', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_routine_item_runs', 'completed_by_user_id')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_runs_assignment_id', 'pulse_routine_runs')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_routine_runs_assignment_id', 'pulse_routine_runs', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_routine_runs', 'routine_assignment_id')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_assignment_extras_assigned_to', 'pulse_routine_assignment_extras')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_assignment_extras_assignment', 'pulse_routine_assignment_extras')
    ah.safe_drop_table(op, conn, 'pulse_routine_assignment_extras')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_item_assignments_assigned_to', 'pulse_routine_item_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_item_assignments_assignment', 'pulse_routine_item_assignments')
    ah.safe_drop_table(op, conn, 'pulse_routine_item_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_assignments_primary_user', 'pulse_routine_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_assignments_company_shift', 'pulse_routine_assignments')
    ah.safe_drop_table(op, conn, 'pulse_routine_assignments')
