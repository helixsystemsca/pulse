"""Blueprint elements: groups (children JSON) + locked flag.

Revision ID: 0050
Revises: 0049
Create Date: 2026-04-08

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blueprint_elements",
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("blueprint_elements", sa.Column("children_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("blueprint_elements", "children_json")
    op.drop_column("blueprint_elements", "locked")
