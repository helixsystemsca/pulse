"""Company flag for onboarding demo monitoring data.

Revision ID: 0045
Revises: 0044
Create Date: 2026-04-04

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("onboarding_demo_sensors", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("companies", "onboarding_demo_sensors")
