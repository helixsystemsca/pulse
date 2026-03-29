"""System admin: flags, system_logs, secure tokens, company soft-delete.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-29

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("users", sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "system_logs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("actor_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "target_company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "target_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_system_logs_action", "system_logs", ["action"])
    op.create_index("ix_system_logs_actor_user_id", "system_logs", ["actor_user_id"])
    op.create_index("ix_system_logs_created_at", "system_logs", ["created_at"])

    op.create_table(
        "system_secure_tokens",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("role", sa.String(32), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_system_secure_tokens_kind", "system_secure_tokens", ["kind"])
    op.create_index("ix_system_secure_tokens_token_hash", "system_secure_tokens", ["token_hash"], unique=True)
    op.create_index("ix_system_secure_tokens_expires_at", "system_secure_tokens", ["expires_at"])
    op.create_index("ix_system_secure_tokens_email", "system_secure_tokens", ["email"])
    op.create_index("ix_system_secure_tokens_user_id", "system_secure_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_table("system_secure_tokens")
    op.drop_table("system_logs")
    op.drop_column("users", "last_active_at")
    op.drop_column("users", "is_system_admin")
    op.drop_column("companies", "is_active")
