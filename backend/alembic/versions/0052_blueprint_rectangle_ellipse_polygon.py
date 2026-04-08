"""Add corner_radius for blueprint rectangle elements."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blueprint_elements",
        sa.Column("corner_radius", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("blueprint_elements", "corner_radius")
