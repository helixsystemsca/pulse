"""Refresh token sessions for JWT phase 2 (dual/cookie auth mode)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1024_user_refresh_sessions"
down_revision = "1023_tenant_rls_child"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "user_refresh_sessions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family_id", UUID(as_uuid=False), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(128), nullable=True),
        sa.UniqueConstraint("token_hash", name="uq_user_refresh_sessions_token_hash"),
    )
    ah.safe_create_index(op, conn, "ix_user_refresh_sessions_user_id", "user_refresh_sessions", ["user_id"])
    ah.safe_create_index(op, conn, "ix_user_refresh_sessions_family_id", "user_refresh_sessions", ["family_id"])
    ah.safe_create_index(op, conn, "ix_user_refresh_sessions_expires_at", "user_refresh_sessions", ["expires_at"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_user_refresh_sessions_expires_at", "user_refresh_sessions")
    ah.safe_drop_index(op, conn, "ix_user_refresh_sessions_family_id", "user_refresh_sessions")
    ah.safe_drop_index(op, conn, "ix_user_refresh_sessions_user_id", "user_refresh_sessions")
    ah.safe_drop_table(op, conn, "user_refresh_sessions")
