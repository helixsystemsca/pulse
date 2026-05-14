"""Add corner_radius for blueprint rectangle elements."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0052'
down_revision = '0051'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'blueprint_elements', sa.Column('corner_radius', sa.Float(), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'blueprint_elements', 'corner_radius')
