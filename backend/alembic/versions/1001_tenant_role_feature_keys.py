"""Add tenant_roles.feature_keys; optional department_id for org-wide roles."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1001_tenant_role_feature_keys"
down_revision = "1000_alpha_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "tenant_roles",
        sa.Column("feature_keys", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    ah.safe_alter_column(
        op,
        conn,
        "tenant_roles",
        "department_id",
        existing_type=UUID(as_uuid=False),
        nullable=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_alter_column(
        op,
        conn,
        "tenant_roles",
        "department_id",
        existing_type=UUID(as_uuid=False),
        nullable=False,
    )
    ah.safe_drop_column(op, conn, "tenant_roles", "feature_keys")
