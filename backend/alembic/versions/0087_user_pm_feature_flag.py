"""user pm feature flag

Revision ID: 0087_user_pm_feature_flag
Revises: 0086_prj_critical_path
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0087_user_pm_feature_flag"
down_revision = "0086_prj_critical_path"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "can_use_pm_features",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "can_use_pm_features")

