"""tiered onboarding progress and unlock flags

Revision ID: 0082_onboarding_tiered_progress
Revises: 0081_soft_start_pm_plans
Create Date: 2026-04-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0082_onboarding_tiered_progress"
down_revision = "0081_soft_start_pm_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_tier1_progress",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("onboarding_tier2_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    op.add_column("users", sa.Column("onboarding_tier2_prompted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "onboarding_tier2_prompted_at")
    op.drop_column("users", "onboarding_started_at")
    op.drop_column("users", "onboarding_tier2_enabled")
    op.drop_column("users", "onboarding_tier1_progress")
