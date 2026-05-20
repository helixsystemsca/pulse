"""Blueprint elements: symbol metadata for map/maintenance symbols."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0038'
down_revision = '0037'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('symbol_type', sa.String(32), nullable=True))
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('symbol_tags', sa.Text(), nullable=True))
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('symbol_notes', sa.Text(), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'symbol_notes')
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'symbol_tags')
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'symbol_type')
