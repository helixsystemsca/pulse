"""company theme/background + avatar approval workflow

Revision ID: 0056
Revises: 0055
Create Date: 2026-04-09

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("background_image_url", sa.String(length=2048), nullable=True))
    op.add_column(
        "companies",
        sa.Column(
            "theme",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.add_column("users", sa.Column("avatar_pending_url", sa.String(length=2048), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "avatar_status",
            sa.Enum("approved", "pending", "rejected", name="avatarstatus", native_enum=False, length=16),
            server_default=sa.text("'approved'"),
            nullable=False,
        ),
    )

    # Existing avatars are implicitly approved.
    op.execute("UPDATE users SET avatar_status = 'approved' WHERE avatar_status IS NULL;")


def downgrade() -> None:
    op.drop_column("users", "avatar_status")
    op.drop_column("users", "avatar_pending_url")
    op.drop_column("companies", "theme")
    op.drop_column("companies", "background_image_url")

