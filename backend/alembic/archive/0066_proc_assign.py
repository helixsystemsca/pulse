"""CMMS: procedure assignments + photo uploads."""
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
revision = '0066_proc_assign'
down_revision = '0065_gam_badges_xp'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_procedure_assignments', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('procedure_id', UUID(as_uuid=False), sa.ForeignKey('pulse_procedures.id', ondelete='CASCADE'), nullable=False), sa.Column('assigned_to_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('assigned_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'), sa.Column('notes', sa.Text(), nullable=True), sa.Column('due_at', sa.DateTime(timezone=True), nullable=True), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_assign_company_status_created', 'pulse_procedure_assignments', ['company_id', 'status', 'created_at'])
    ah.safe_create_index(op, conn, 'ix_pulse_proc_assign_to_status', 'pulse_procedure_assignments', ['assigned_to_user_id', 'status'])
    ah.safe_create_table(op, conn, 'pulse_procedure_assignment_photos', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('assignment_id', UUID(as_uuid=False), sa.ForeignKey('pulse_procedure_assignments.id', ondelete='CASCADE'), nullable=False), sa.Column('uploaded_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('photo_path', sa.String(length=512), nullable=False), sa.Column('content_type', sa.String(length=64), nullable=False, server_default='image/jpeg'), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, conn, 'ix_pulse_proc_assign_photo_assignment_created', 'pulse_procedure_assignment_photos', ['assignment_id', 'created_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_assign_photo_assignment_created', 'pulse_procedure_assignment_photos')
    ah.safe_drop_table(op, conn, 'pulse_procedure_assignment_photos')
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_assign_to_status', 'pulse_procedure_assignments')
    ah.safe_drop_index(op, conn, 'ix_pulse_proc_assign_company_status_created', 'pulse_procedure_assignments')
    ah.safe_drop_table(op, conn, 'pulse_procedure_assignments')
