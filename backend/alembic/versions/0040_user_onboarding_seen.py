"""Users: onboarding_seen for first-login intro (non-blocking)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("onboarding_seen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    # Existing accounts: skip intro so deploy does not interrupt everyone.
    op.execute(sa.text("UPDATE users SET onboarding_seen = true"))


def downgrade() -> None:
    op.drop_column("users", "onboarding_seen")
