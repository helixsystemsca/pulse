"""Blueprint elements: orthogonal connection lines (symbol/symbol links).

Revision ID: 0051
Revises: 0050
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

revision = '0051'
down_revision = '0050'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('connection_from_id', sa.UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('connection_to_id', sa.UUID(as_uuid=False), nullable=True))
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('connection_style', sa.String(length=16), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'connection_style')
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'connection_to_id')
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'connection_from_id')
