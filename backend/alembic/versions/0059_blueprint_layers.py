"""Blueprint layer stack (layers_json + blueprint_elements.layer_id)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blueprints", sa.Column("layers_json", sa.Text(), nullable=True))
    op.add_column(
        "blueprint_elements",
        sa.Column("layer_id", sa.String(length=36), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("blueprint_elements", "layer_id")
    op.drop_column("blueprints", "layers_json")
