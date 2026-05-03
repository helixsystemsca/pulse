"""Remove per-user onboarding and company demo-sensors flag."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0098_drop_onboarding_columns"
down_revision = "0097_pm_coordination_layer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("companies", "onboarding_demo_sensors")
    op.drop_column("users", "onboarding_tier2_prompted_at")
    op.drop_column("users", "onboarding_started_at")
    op.drop_column("users", "onboarding_tier2_enabled")
    op.drop_column("users", "onboarding_tier1_progress")
    op.drop_column("users", "user_onboarding_tour_completed")
    op.drop_column("users", "onboarding_seen")
    op.drop_column("users", "onboarding_steps")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "onboarding_enabled")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("onboarding_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "users",
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("onboarding_seen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column(
            "user_onboarding_tour_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
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
    op.add_column(
        "users",
        sa.Column("onboarding_tier2_prompted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column("onboarding_demo_sensors", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
