"""Remove deprecated workspace.view RBAC (department hub flags removed)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0127_drop_workspace_view_rbac"
down_revision = "0126_rbac_catalog_dashboard_view"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM tenant_role_grants WHERE permission_key = 'workspace.view'"))
    op.execute(sa.text("DELETE FROM rbac_catalog_permissions WHERE key = 'workspace.view'"))


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO rbac_catalog_permissions (key, description)
            VALUES ('workspace.view', 'Open a department workspace hub')
            ON CONFLICT (key) DO NOTHING
            """
        )
    )
