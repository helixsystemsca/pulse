"""Append-only RBAC audit events (entitlement / override changes)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0128_rbac_audit_events'
down_revision = '0127_drop_workspace_view_rbac'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'rbac_audit_events', sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True, nullable=False), sa.Column('company_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=True), sa.Column('actor_user_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=False), sa.Column('action', sa.String(length=128), nullable=False), sa.Column('target_user_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=True), sa.Column('payload', sa.JSON(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'))
    ah.safe_create_index(op, conn, 'ix_rbac_audit_events_company_id', 'rbac_audit_events', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_rbac_audit_events_actor_user_id', 'rbac_audit_events', ['actor_user_id'])
    ah.safe_create_index(op, conn, 'ix_rbac_audit_events_target_user_id', 'rbac_audit_events', ['target_user_id'])
    ah.safe_create_index(op, conn, 'ix_rbac_audit_events_action', 'rbac_audit_events', ['action'])
    ah.safe_create_index(op, conn, 'ix_rbac_audit_events_created_at', 'rbac_audit_events', ['created_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_rbac_audit_events_created_at', 'rbac_audit_events')
    ah.safe_drop_index(op, conn, 'ix_rbac_audit_events_action', 'rbac_audit_events')
    ah.safe_drop_index(op, conn, 'ix_rbac_audit_events_target_user_id', 'rbac_audit_events')
    ah.safe_drop_index(op, conn, 'ix_rbac_audit_events_actor_user_id', 'rbac_audit_events')
    ah.safe_drop_index(op, conn, 'ix_rbac_audit_events_company_id', 'rbac_audit_events')
    ah.safe_drop_table(op, conn, 'rbac_audit_events')
