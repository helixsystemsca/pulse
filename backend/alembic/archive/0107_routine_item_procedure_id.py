"""Routine checklist lines: optional link to pulse_procedures (SOP library)."""
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
revision = '0107_routine_item_procedure_id'
down_revision = '0106_routine_item_shift_band'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_routine_items', sa.Column('procedure_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_routine_items_procedure_id', 'pulse_routine_items', 'pulse_procedures', ['procedure_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_routine_items_procedure_id', 'pulse_routine_items', ['procedure_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_items_procedure_id', 'pulse_routine_items')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_routine_items_procedure_id', 'pulse_routine_items', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_routine_items', 'procedure_id')
