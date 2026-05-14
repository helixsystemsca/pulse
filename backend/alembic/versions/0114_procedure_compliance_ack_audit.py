"""Procedure compliance metadata + immutable acknowledgment audit fields."""
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
revision = '0114_procedure_compliance_ack_audit'
down_revision = '0113_operational_xp_recognition'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('procedure_category', sa.String(length=128), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('semantic_version', sa.String(length=32), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('revision_date', sa.Date(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('publication_state', sa.String(length=20), nullable=False, server_default='published'))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('requires_reacknowledgment', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_add_column(op, conn, 'pulse_procedure_acknowledgements', sa.Column('acknowledgment_statement', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_procedure_acknowledgements', sa.Column('acknowledgment_note', sa.String(length=2000), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_ack_company_ack_at', 'pulse_procedure_acknowledgements', ['company_id', 'acknowledged_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_ack_company_ack_at', 'pulse_procedure_acknowledgements')
    ah.safe_drop_column(op, conn, 'pulse_procedure_acknowledgements', 'acknowledgment_note')
    ah.safe_drop_column(op, conn, 'pulse_procedure_acknowledgements', 'acknowledgment_statement')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'requires_reacknowledgment')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'is_active')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'publication_state')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'revision_date')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'semantic_version')
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'procedure_category')
