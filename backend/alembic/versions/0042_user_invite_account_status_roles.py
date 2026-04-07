"""Users: invite onboarding (account_status, token), nullable password; roles lead & supervisor."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "account_status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
    )
    op.add_column("users", sa.Column("invite_token_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=True)
    op.create_index("ix_users_invite_token_hash", "users", ["invite_token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_invite_token_hash", table_name="users")
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=False)
    op.drop_column("users", "invite_expires_at")
    op.drop_column("users", "invite_token_hash")
    op.drop_column("users", "account_status")
