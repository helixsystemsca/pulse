"""Add companies.header_image_url for Operations dashboard banner."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("header_image_url", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "header_image_url")
