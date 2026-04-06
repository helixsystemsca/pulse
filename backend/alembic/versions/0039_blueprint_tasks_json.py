"""Blueprints: optional task overlays JSON (instructions linked to elements)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blueprints", sa.Column("tasks_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("blueprints", "tasks_json")
