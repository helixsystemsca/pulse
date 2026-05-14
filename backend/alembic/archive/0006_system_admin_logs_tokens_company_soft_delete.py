"""System admin: flags, system_logs, secure tokens, company soft-delete.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-29

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
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if ah.column_exists(conn, 'users', 'is_system_admin'):
        return
    ah.safe_add_column(op, conn, 'companies', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    ah.safe_add_column(op, conn, 'users', sa.Column('is_system_admin', sa.Boolean(), nullable=False, server_default='false'))
    ah.safe_add_column(op, conn, 'users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_table(op, conn, 'system_logs', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('action', sa.String(128), nullable=False), sa.Column('actor_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('target_company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True), sa.Column('target_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('metadata', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_system_logs_action', 'system_logs', ['action'])
    ah.safe_create_index(op, conn, 'ix_system_logs_actor_user_id', 'system_logs', ['actor_user_id'])
    ah.safe_create_index(op, conn, 'ix_system_logs_created_at', 'system_logs', ['created_at'])
    ah.safe_create_table(op, conn, 'system_secure_tokens', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('kind', sa.String(32), nullable=False), sa.Column('token_hash', sa.String(128), nullable=False), sa.Column('email', sa.String(320), nullable=True), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=True), sa.Column('role', sa.String(32), nullable=True), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False), sa.Column('used_at', sa.DateTime(timezone=True), nullable=True), sa.Column('created_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_system_secure_tokens_kind', 'system_secure_tokens', ['kind'])
    ah.safe_create_index(op, conn, 'ix_system_secure_tokens_token_hash', 'system_secure_tokens', ['token_hash'], unique=True)
    ah.safe_create_index(op, conn, 'ix_system_secure_tokens_expires_at', 'system_secure_tokens', ['expires_at'])
    ah.safe_create_index(op, conn, 'ix_system_secure_tokens_email', 'system_secure_tokens', ['email'])
    ah.safe_create_index(op, conn, 'ix_system_secure_tokens_user_id', 'system_secure_tokens', ['user_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, 'system_secure_tokens')
    ah.safe_drop_table(op, conn, 'system_logs')
    ah.safe_drop_column(op, conn, 'users', 'last_active_at')
    ah.safe_drop_column(op, conn, 'users', 'is_system_admin')
    ah.safe_drop_column(op, conn, 'companies', 'is_active')
