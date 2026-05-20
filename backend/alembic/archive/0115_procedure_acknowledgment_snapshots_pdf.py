"""Immutable procedure acknowledgment snapshots + stored PDF audit artifacts."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0115_proc_ack_snapshots'
down_revision = '0114_proc_compliance_ack'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_procedure_acknowledgment_snapshots', sa.Column('id', UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('acknowledgment_id', UUID(as_uuid=False), sa.ForeignKey('pulse_procedure_acknowledgements.id', ondelete='CASCADE'), nullable=False, unique=True), sa.Column('procedure_id', UUID(as_uuid=False), sa.ForeignKey('pulse_procedures.id', ondelete='CASCADE'), nullable=False), sa.Column('procedure_version', sa.Integer(), nullable=False), sa.Column('procedure_title', sa.String(length=512), nullable=False), sa.Column('procedure_category', sa.String(length=128), nullable=True), sa.Column('procedure_semantic_version', sa.String(length=32), nullable=True), sa.Column('procedure_revision_date', sa.Date(), nullable=True), sa.Column('procedure_revision_summary', sa.Text(), nullable=True), sa.Column('procedure_content_snapshot', JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column('acknowledgment_statement_text', sa.Text(), nullable=False), sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=False), sa.Column('worker_full_name', sa.String(length=255), nullable=True), sa.Column('worker_job_title', sa.String(length=255), nullable=True), sa.Column('worker_operational_role', sa.String(length=32), nullable=True), sa.Column('generated_pdf_url', sa.String(length=2048), nullable=True), sa.Column('pdf_generated_at', sa.DateTime(timezone=True), nullable=True), sa.Column('pdf_generation_error', sa.String(length=2000), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_ack_snap_procedure', 'pulse_procedure_acknowledgment_snapshots', ['procedure_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_ack_snap_procedure', 'pulse_procedure_acknowledgment_snapshots')
    ah.safe_drop_table(op, conn, 'pulse_procedure_acknowledgment_snapshots')
