"""Add equipment.manage to RBAC catalog (mutations beyond view)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0125_rbac_catalog_equipment_manage"
down_revision = "0124_rbac_catalog_compliance_manage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO rbac_catalog_permissions (key, description)
            VALUES (
                'equipment.manage',
                'Create, update, and delete facility equipment and parts'
            )
            ON CONFLICT (key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM rbac_catalog_permissions WHERE key = 'equipment.manage'"))
