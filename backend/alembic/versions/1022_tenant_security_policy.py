"""Tenant security policy JSON + user MFA/SSO tracking columns."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1022_tenant_security_policy"
down_revision = "1021_tenant_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "companies",
        sa.Column("security_policy", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    ah.safe_add_column(op, conn, "users", sa.Column("mfa_enrolled_at", sa.DateTime(timezone=True), nullable=True))
    ah.safe_add_column(op, conn, "users", sa.Column("mfa_method", sa.String(32), nullable=True))
    ah.safe_add_column(op, conn, "users", sa.Column("sso_subject", sa.String(255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "users", "sso_subject")
    ah.safe_drop_column(op, conn, "users", "mfa_method")
    ah.safe_drop_column(op, conn, "users", "mfa_enrolled_at")
    ah.safe_drop_column(op, conn, "companies", "security_policy")
