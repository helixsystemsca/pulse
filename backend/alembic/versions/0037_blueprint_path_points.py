"""Blueprint elements: optional polygon points for free-draw paths."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blueprint_elements", sa.Column("path_points", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("blueprint_elements", "path_points")
