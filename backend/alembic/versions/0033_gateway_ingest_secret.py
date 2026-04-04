"""Per-gateway ingest API secret (hashed) for ESP32 / outbound-only device auth."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "automation_gateways",
        sa.Column("ingest_secret_hash", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("automation_gateways", "ingest_secret_hash")
