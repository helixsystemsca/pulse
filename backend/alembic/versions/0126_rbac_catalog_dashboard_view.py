"""Add dashboard.view to RBAC catalog (leadership /overview tenant feature)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0126_rbac_catalog_dashboard_view"
down_revision = "0125_rbac_catalog_equipment_manage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO rbac_catalog_permissions (key, description)
            VALUES (
                'dashboard.view',
                'View leadership / operations dashboard'
            )
            ON CONFLICT (key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM rbac_catalog_permissions WHERE key = 'dashboard.view'"))
