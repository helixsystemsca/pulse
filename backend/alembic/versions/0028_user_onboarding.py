"""Per-user onboarding checklist (enabled, completed, steps JSON)."""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

_STEPS = [
    {"key": "create_zone", "completed": False},
    {"key": "add_device", "completed": False},
    {"key": "create_work_order", "completed": False},
    {"key": "view_operations", "completed": False},
]
_STEPS_LITERAL = json.dumps(_STEPS)


def upgrade() -> None:
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
            JSONB(),
            nullable=False,
            server_default=sa.text(f"'{_STEPS_LITERAL}'::jsonb"),
        ),
    )
    # Existing accounts: do not surface onboarding prompts.
    op.execute(
        sa.text("UPDATE users SET onboarding_completed = true, onboarding_enabled = false WHERE true")
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_steps")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "onboarding_enabled")
