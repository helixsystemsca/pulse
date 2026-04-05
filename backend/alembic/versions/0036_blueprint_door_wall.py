"""Blueprint elements: optional wall attachment for doors."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blueprint_elements", sa.Column("wall_attachment", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("blueprint_elements", "wall_attachment")
