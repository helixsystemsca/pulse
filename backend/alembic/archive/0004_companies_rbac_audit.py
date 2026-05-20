"""Tenants → companies, hierarchical RBAC, role_permissions, audit_logs.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-26

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import text
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, 'tenants'):
        return
    ah.safe_add_column(op, conn, 'users', sa.Column('created_by', UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'users', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_add_column(op, conn, 'users', sa.Column('permission_deny', JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False))
    ah.safe_create_foreign_key(op, conn, 'fk_users_created_by', 'users', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.execute(text('ALTER TABLE tenants RENAME TO companies'))
    for tbl in ('users', 'zones', 'tools', 'domain_events', 'inventory_items', 'jobs', 'maintenance_schedules', 'maintenance_logs', 'notification_rules'):
        op.execute(text(f'ALTER TABLE "{tbl}" RENAME COLUMN tenant_id TO company_id'))
    ah.safe_add_column(op, conn, 'companies', sa.Column('owner_admin_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_companies_owner_admin', 'companies', 'users', ['owner_admin_id'], ['id'], ondelete='SET NULL')
    op.execute(text('ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL'))
    ah.safe_drop_constraint(op, conn, 'uq_user_tenant_email', 'users', type_='unique')
    ah.safe_create_index(op, conn, 'uq_users_email', 'users', ['email'], unique=True)
    op.execute(text("\n            ALTER TABLE users\n            ALTER COLUMN role TYPE VARCHAR(32)\n            USING (\n              CASE role::text\n                WHEN 'admin' THEN 'company_admin'\n                WHEN 'worker' THEN 'worker'\n                ELSE 'worker'\n              END\n            )\n            "))
    op.execute(text('DROP TYPE IF EXISTS userrole'))
    op.execute(text("\n            UPDATE notification_rules\n            SET target_role = 'company_admin'\n            WHERE target_role = 'admin'\n            "))
    op.execute(text("\n            DO $$\n            BEGIN\n              IF EXISTS (\n                SELECT 1 FROM pg_constraint WHERE conname = 'uq_tool_tenant_tag'\n              ) THEN\n                ALTER TABLE tools RENAME CONSTRAINT uq_tool_tenant_tag TO uq_tool_company_tag;\n              END IF;\n            END $$;\n            "))
    ah.safe_create_table(op, conn, 'role_permissions', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('role', sa.String(length=32), nullable=False), sa.Column('permissions', JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.UniqueConstraint('company_id', 'role', name='uq_role_permissions_company_role'))
    ah.safe_create_index(op, conn, 'ix_role_permissions_company_id', 'role_permissions', ['company_id'])
    ah.safe_create_table(op, conn, 'audit_logs', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('actor_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True), sa.Column('action', sa.String(length=128), nullable=False), sa.Column('metadata', JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    ah.safe_create_index(op, conn, 'ix_audit_logs_actor_user_id', 'audit_logs', ['actor_user_id'])
    ah.safe_create_index(op, conn, 'ix_audit_logs_company_id', 'audit_logs', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_audit_logs_action', 'audit_logs', ['action'])
    ah.safe_create_index(op, conn, 'ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.execute(text("\n            UPDATE companies c\n            SET owner_admin_id = u.id\n            FROM users u\n            WHERE u.company_id = c.id AND u.role = 'company_admin'\n            AND c.owner_admin_id IS NULL\n            AND u.id = (\n              SELECT u2.id FROM users u2\n              WHERE u2.company_id = c.id AND u2.role = 'company_admin'\n              ORDER BY u2.created_at NULLS LAST\n              LIMIT 1\n            )\n            "))

def downgrade() -> None:
    conn = op.get_bind()
    raise NotImplementedError('Downgrade not supported for RBAC migration')
