"""Track the authentication provider used by users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0104_user_auth_provider"
down_revision = "0103_merge_routine_and_project_summary_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=32), server_default=sa.text("'email'"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "auth_provider")
