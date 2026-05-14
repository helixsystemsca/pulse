"""Users: onboarding_seen for first-login intro (non-blocking)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0040'
down_revision = '0039'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_seen', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.execute(sa.text('UPDATE users SET onboarding_seen = true'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'onboarding_seen')
