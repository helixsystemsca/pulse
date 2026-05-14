"""Add tenant_roles.feature_keys; optional department_id for org-wide roles."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "1001_tenant_role_feature_keys"
down_revision = "1000_alpha_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_roles",
        sa.Column("feature_keys", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.alter_column("tenant_roles", "department_id", existing_type=UUID(as_uuid=False), nullable=True)


def downgrade() -> None:
    op.alter_column("tenant_roles", "department_id", existing_type=UUID(as_uuid=False), nullable=False)
    op.drop_column("tenant_roles", "feature_keys")
