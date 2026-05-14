"""CMMS: procedure revision metadata + assignment kind."""
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
revision = '0067_proc_rev_kind'
down_revision = '0066_proc_assign'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('revised_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('revised_by_name', sa.String(length=255), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('revised_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_procedures_revised_by_user_id', 'pulse_procedures', ['revised_by_user_id'])
    ah.safe_add_column(op, conn, 'pulse_procedure_assignments', sa.Column('kind', sa.String(length=16), nullable=False, server_default='complete'))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_assign_kind', 'pulse_procedure_assignments', ['kind'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_assign_kind', 'pulse_procedure_assignments')
    ah.safe_drop_column(op, conn, 'pulse_procedure_assignments', 'kind')
    ah.safe_drop_index(op, conn, 'ix_pulse_procedures_revised_by_user_id', 'pulse_procedures')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'revised_at')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'revised_by_name')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'revised_by_user_id')
