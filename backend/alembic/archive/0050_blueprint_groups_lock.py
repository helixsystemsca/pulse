"""Blueprint elements: groups (children JSON) + locked flag.

Revision ID: 0050
Revises: 0049
Create Date: 2026-04-08

"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0050'
down_revision = '0049'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('locked', sa.Boolean(), nullable=False, server_default=sa.false()))
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('children_json', sa.Text(), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'children_json')
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'locked')
