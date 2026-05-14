"""Pulse workers HR: certifications, skills, training, company settings.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-02

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, 'pulse_worker_hr'):
        ah.safe_create_table(op, conn, 'pulse_worker_hr', sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('phone', sa.String(64), nullable=True), sa.Column('department', sa.String(128), nullable=True), sa.Column('job_title', sa.String(255), nullable=True), sa.Column('shift', sa.String(64), nullable=True), sa.Column('supervisor_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('start_date', sa.Date(), nullable=True), sa.Column('supervisor_notes', sa.Text(), nullable=True), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_pulse_worker_hr_company_id', 'pulse_worker_hr', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_pulse_worker_hr_supervisor_user_id', 'pulse_worker_hr', ['supervisor_user_id'])
    if not ah.table_exists(conn, 'pulse_worker_certifications'):
        ah.safe_create_table(op, conn, 'pulse_worker_certifications', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_pulse_worker_certifications_user_id', 'pulse_worker_certifications', ['user_id'])
        ah.safe_create_index(op, conn, 'ix_pulse_worker_certifications_company_id', 'pulse_worker_certifications', ['company_id'])
    if not ah.table_exists(conn, 'pulse_worker_skills'):
        ah.safe_create_table(op, conn, 'pulse_worker_skills', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(128), nullable=False), sa.Column('level', sa.Integer(), nullable=False, server_default='1'), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_pulse_worker_skills_user_id', 'pulse_worker_skills', ['user_id'])
        ah.safe_create_index(op, conn, 'ix_pulse_worker_skills_company_id', 'pulse_worker_skills', ['company_id'])
    if not ah.table_exists(conn, 'pulse_worker_training'):
        ah.safe_create_table(op, conn, 'pulse_worker_training', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_pulse_worker_training_user_id', 'pulse_worker_training', ['user_id'])
        ah.safe_create_index(op, conn, 'ix_pulse_worker_training_company_id', 'pulse_worker_training', ['company_id'])
    if not ah.table_exists(conn, 'pulse_workers_settings'):
        ah.safe_create_table(op, conn, 'pulse_workers_settings', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('settings', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_pulse_workers_settings_company_id', 'pulse_workers_settings', ['company_id'], unique=True)

def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'pulse_workers_settings'):
        ah.safe_drop_table(op, conn, 'pulse_workers_settings')
    if ah.table_exists(conn, 'pulse_worker_training'):
        ah.safe_drop_table(op, conn, 'pulse_worker_training')
    if ah.table_exists(conn, 'pulse_worker_skills'):
        ah.safe_drop_table(op, conn, 'pulse_worker_skills')
    if ah.table_exists(conn, 'pulse_worker_certifications'):
        ah.safe_drop_table(op, conn, 'pulse_worker_certifications')
    if ah.table_exists(conn, 'pulse_worker_hr'):
        ah.safe_drop_table(op, conn, 'pulse_worker_hr')
