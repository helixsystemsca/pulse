"""Add companies.logo_url for tenant branding."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("logo_url", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "logo_url")
