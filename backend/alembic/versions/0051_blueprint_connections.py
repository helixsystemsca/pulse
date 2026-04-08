"""Blueprint elements: orthogonal connection lines (symbol/symbol links).

Revision ID: 0051
Revises: 0050
Create Date: 2026-04-08

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blueprint_elements",
        sa.Column("connection_from_id", sa.UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "blueprint_elements",
        sa.Column("connection_to_id", sa.UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "blueprint_elements",
        sa.Column("connection_style", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("blueprint_elements", "connection_style")
    op.drop_column("blueprint_elements", "connection_to_id")
    op.drop_column("blueprint_elements", "connection_from_id")
