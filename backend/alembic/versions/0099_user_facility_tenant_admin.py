"""Add facility_tenant_admin — in-facility tenant delegate without company_admin role."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0099_user_facility_tenant_admin"
down_revision = "0098_drop_onboarding_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "facility_tenant_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "facility_tenant_admin")
