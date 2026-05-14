"""Merge heads: procedure worker completion audit + procedure critical / revision metadata."""
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
revision = '0112_proc_worker_completions'
down_revision = ('0111_inventory_contractors', '0111_training_matrix_override')
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('is_critical', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('revision_notes', sa.Text(), nullable=True))
    ah.safe_alter_column(op, conn, 'pulse_procedures', 'is_critical', server_default=None)
    ah.safe_create_table(op, conn, 'pulse_procedure_worker_completions', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('employee_user_id', UUID(as_uuid=False), nullable=False), sa.Column('procedure_id', UUID(as_uuid=False), nullable=False), sa.Column('revision_number', sa.Integer(), nullable=False), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False), sa.Column('expires_at', sa.Date(), nullable=True), sa.Column('primary_acknowledged_at', sa.DateTime(timezone=True), nullable=False), sa.Column('secondary_acknowledged_at', sa.DateTime(timezone=True), nullable=True), sa.Column('quiz_score_percent', sa.Integer(), nullable=True), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['employee_user_id'], ['users.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['procedure_id'], ['pulse_procedures.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('company_id', 'employee_user_id', 'procedure_id', 'revision_number', name='uq_pulse_proc_worker_completion_emp_proc_rev'))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_worker_comp_proc', 'pulse_procedure_worker_completions', ['procedure_id'], unique=False)
    ah.safe_create_index(op, conn, 'ix_pulse_proc_worker_comp_emp', 'pulse_procedure_worker_completions', ['employee_user_id'], unique=False)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_worker_comp_emp', 'pulse_procedure_worker_completions')
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_worker_comp_proc', 'pulse_procedure_worker_completions')
    ah.safe_drop_table(op, conn, 'pulse_procedure_worker_completions')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'revision_notes')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'published_at')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'is_critical')
