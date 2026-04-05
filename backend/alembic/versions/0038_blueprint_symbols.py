"""Blueprint elements: symbol metadata for map/maintenance symbols."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blueprint_elements", sa.Column("symbol_type", sa.String(32), nullable=True))
    op.add_column("blueprint_elements", sa.Column("symbol_tags", sa.Text(), nullable=True))
    op.add_column("blueprint_elements", sa.Column("symbol_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("blueprint_elements", "symbol_notes")
    op.drop_column("blueprint_elements", "symbol_tags")
    op.drop_column("blueprint_elements", "symbol_type")
