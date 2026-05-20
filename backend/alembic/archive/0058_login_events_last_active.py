"""login_events table + users.last_active_at.

Revision ID: 0058
Revises: 0057
Create Date: 2026-04-11

"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects import postgresql
revision = '0058'
down_revision = '0057'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'login_events', sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False), sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False), sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False), sa.Column('ip_address', sa.String(length=128), nullable=False), sa.Column('city', sa.String(length=255), nullable=True), sa.Column('region', sa.String(length=255), nullable=True), sa.Column('country', sa.String(length=255), nullable=True), sa.Column('user_agent', sa.Text(), nullable=True), sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_login_events_user_id', 'login_events', ['user_id'], unique=False)
    ah.safe_create_index(op, conn, 'ix_login_events_user_timestamp', 'login_events', ['user_id', 'timestamp'], unique=False)
    ah.safe_add_column(op, conn, 'users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_login_events_user_timestamp', 'login_events')
    ah.safe_drop_index(op, conn, 'ix_login_events_user_id', 'login_events')
    ah.safe_drop_table(op, conn, 'login_events')
    ah.safe_drop_column(op, conn, 'users', 'last_active_at')
