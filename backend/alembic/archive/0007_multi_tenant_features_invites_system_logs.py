"""Multi-tenant SaaS alignment: company_features, invites, system_logs, last_login.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-29

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, 'company_features'):
        ah.safe_create_table(op, conn, 'company_features', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('feature_name', sa.String(128), nullable=False), sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'), sa.UniqueConstraint('company_id', 'feature_name', name='uq_company_features_company_feature'))
        ah.safe_create_index(op, conn, 'ix_company_features_company_id', 'company_features', ['company_id'])
    if ah.column_exists(conn, 'companies', 'enabled_features'):
        op.execute(text("\n                INSERT INTO company_features (id, company_id, feature_name, enabled)\n                SELECT gen_random_uuid(), c.id, elem, true\n                FROM companies c\n                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.enabled_features, '[]'::jsonb)) AS elem\n                ON CONFLICT (company_id, feature_name) DO NOTHING\n                "))
        ah.safe_drop_column(op, conn, 'companies', 'enabled_features')
    if not ah.table_exists(conn, 'invites'):
        ah.safe_create_table(op, conn, 'invites', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('email', sa.String(320), nullable=False), sa.Column('role', sa.String(32), nullable=False), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('token_hash', sa.String(128), nullable=False), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False), sa.Column('used', sa.Boolean(), nullable=False, server_default='false'), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.Column('created_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
        ah.safe_create_index(op, conn, 'ix_invites_email', 'invites', ['email'])
        ah.safe_create_index(op, conn, 'ix_invites_company_id', 'invites', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_invites_token_hash', 'invites', ['token_hash'], unique=True)
        op.execute(text("\n                INSERT INTO invites (\n                    id, email, role, company_id, token_hash, expires_at, used, created_at, created_by_user_id\n                )\n                SELECT\n                    id,\n                    COALESCE(email, ''),\n                    COALESCE(role, 'company_admin'),\n                    company_id,\n                    token_hash,\n                    expires_at,\n                    (used_at IS NOT NULL),\n                    created_at,\n                    created_by_user_id\n                FROM system_secure_tokens\n                WHERE kind = 'company_admin_invite'\n                "))
        op.execute(text("DELETE FROM system_secure_tokens WHERE kind = 'company_admin_invite'"))
    if ah.table_exists(conn, 'system_logs') and ah.column_exists(conn, 'system_logs', 'actor_user_id'):
        op.execute(text('ALTER TABLE system_logs RENAME COLUMN actor_user_id TO performed_by'))
        ah.safe_add_column(op, conn, 'system_logs', sa.Column('target_type', sa.String(32), nullable=True))
        ah.safe_add_column(op, conn, 'system_logs', sa.Column('target_id', sa.String(64), nullable=True))
        op.execute(text("\n                UPDATE system_logs SET\n                    target_type = CASE\n                        WHEN target_company_id IS NOT NULL THEN 'company'\n                        WHEN target_user_id IS NOT NULL THEN 'user'\n                        ELSE NULL\n                    END,\n                    target_id = COALESCE(target_company_id::text, target_user_id::text)\n                "))
        op.execute(text('ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_target_company_id_fkey'))
        op.execute(text('ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_target_user_id_fkey'))
        ah.safe_drop_column(op, conn, 'system_logs', 'target_company_id')
        ah.safe_drop_column(op, conn, 'system_logs', 'target_user_id')
        op.execute(text('ALTER TABLE system_logs RENAME COLUMN created_at TO logged_at'))
    if ah.column_exists(conn, 'users', 'last_active_at'):
        if ah.column_exists(conn, 'users', 'last_login'):
            op.execute(text('UPDATE users SET last_login = COALESCE(last_login, last_active_at)'))
            ah.safe_drop_column(op, conn, 'users', 'last_active_at')
        else:
            op.execute(text('ALTER TABLE users RENAME COLUMN last_active_at TO last_login'))

def downgrade() -> None:
    conn = op.get_bind()
    if ah.column_exists(conn, 'users', 'last_login') and (not ah.column_exists(conn, 'users', 'last_active_at')):
        op.execute(text('ALTER TABLE users RENAME COLUMN last_login TO last_active_at'))
    op.execute(text('ALTER TABLE system_logs RENAME COLUMN logged_at TO created_at'))
    ah.safe_add_column(op, conn, 'system_logs', sa.Column('target_company_id', UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'system_logs', sa.Column('target_user_id', UUID(as_uuid=False), nullable=True))
    op.execute(text("\n            UPDATE system_logs SET\n                target_company_id = CASE WHEN target_type = 'company' THEN target_id::uuid ELSE NULL END,\n                target_user_id = CASE WHEN target_type = 'user' THEN target_id::uuid ELSE NULL END\n            "))
    ah.safe_create_foreign_key(op, conn, 'system_logs_target_company_id_fkey', 'system_logs', 'companies', ['target_company_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_foreign_key(op, conn, 'system_logs_target_user_id_fkey', 'system_logs', 'users', ['target_user_id'], ['id'], ondelete='SET NULL')
    ah.safe_drop_column(op, conn, 'system_logs', 'target_type')
    ah.safe_drop_column(op, conn, 'system_logs', 'target_id')
    op.execute(text('ALTER TABLE system_logs RENAME COLUMN performed_by TO actor_user_id'))
    op.execute(text("\n            INSERT INTO system_secure_tokens (\n                id, kind, token_hash, email, user_id, company_id, role, expires_at, used_at,\n                created_by_user_id, created_at\n            )\n            SELECT\n                id,\n                'company_admin_invite',\n                token_hash,\n                NULLIF(email, ''),\n                NULL,\n                company_id,\n                role,\n                expires_at,\n                CASE WHEN used THEN NOW() ELSE NULL END,\n                created_by_user_id,\n                created_at\n            FROM invites\n            "))
    ah.safe_drop_index(op, conn, 'ix_invites_token_hash', 'invites')
    ah.safe_drop_index(op, conn, 'ix_invites_company_id', 'invites')
    ah.safe_drop_index(op, conn, 'ix_invites_email', 'invites')
    ah.safe_drop_table(op, conn, 'invites')
    ah.safe_add_column(op, conn, 'companies', sa.Column('enabled_features', JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False))
    op.execute(text("\n            UPDATE companies c SET enabled_features = COALESCE(\n                (SELECT jsonb_agg(cf.feature_name ORDER BY cf.feature_name)\n                 FROM company_features cf\n                 WHERE cf.company_id = c.id AND cf.enabled = true),\n                '[]'::jsonb\n            )\n            "))
    ah.safe_drop_index(op, conn, 'ix_company_features_company_id', 'company_features')
    ah.safe_drop_table(op, conn, 'company_features')
