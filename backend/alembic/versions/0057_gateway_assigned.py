"""automation_gateways.assigned for plug-and-play onboarding (unassigned pool).

Revision ID: 0057
Revises: 0056
Create Date: 2026-04-10

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "automation_gateways",
        sa.Column("assigned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute(sa.text("UPDATE automation_gateways SET assigned = (zone_id IS NOT NULL)"))
    op.alter_column("automation_gateways", "assigned", server_default=None)


def downgrade() -> None:
    op.drop_column("automation_gateways", "assigned")
