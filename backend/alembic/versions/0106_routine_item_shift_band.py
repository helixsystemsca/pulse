"""Routine checklist items: optional shift band (day / afternoon / night)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0106_routine_item_shift_band'
down_revision = '0105_pulse_procedure_training'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_routine_items', sa.Column('shift_band', sa.String(length=16), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_routine_items_routine_shift_band', 'pulse_routine_items', ['routine_id', 'shift_band'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_routine_items_routine_shift_band', 'pulse_routine_items')
    ah.safe_drop_column(op, conn, 'pulse_routine_items', 'shift_band')
