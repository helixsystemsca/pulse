"""Add compliance.manage to RBAC catalog (mutations beyond view)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0124_rbac_catalog_compliance_manage"
down_revision = "0123_tenant_rbac_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO rbac_catalog_permissions (key, description)
            VALUES (
                'compliance.manage',
                'Manage compliance records (review, resend, flag, escalate)'
            )
            ON CONFLICT (key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM rbac_catalog_permissions WHERE key = 'compliance.manage'"))
