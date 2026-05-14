"""pulse_procedures: creator + review workflow columns

Revision ID: 0061_pulse_procedures_wf
Revises: 0060_pulse_schedule_assignments
Create Date: 2026-04-14
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

from sqlalchemy.dialects.postgresql import UUID
revision = '0061_pulse_procedures_wf'
down_revision = '0060_pulse_schedule_assignments'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('created_by_user_id', UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('created_by_name', sa.String(length=255), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('review_required', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('reviewed_by_user_id', UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('reviewed_by_name', sa.String(length=255), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_procedures_created_by_user_id_users', 'pulse_procedures', 'users', ['created_by_user_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_procedures_reviewed_by_user_id_users', 'pulse_procedures', 'users', ['reviewed_by_user_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_procedures_created_by_user_id', 'pulse_procedures', ['created_by_user_id'])
    ah.safe_alter_column(op, conn, 'pulse_procedures', 'review_required', server_default=None)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_procedures_created_by_user_id', 'pulse_procedures')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_procedures_reviewed_by_user_id_users', 'pulse_procedures', type_='foreignkey')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_procedures_created_by_user_id_users', 'pulse_procedures', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'reviewed_at')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'reviewed_by_name')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'reviewed_by_user_id')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'review_required')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'created_by_name')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'created_by_user_id')
