"""User auth hardening: failed-login lockout + JWT token_version for server-side revocation."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0117_user_lockout_token_version'
down_revision = '0116_proc_compliance_tags'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('token_version', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, conn, 'users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default=sa.text('0')))
    ah.safe_add_column(op, conn, 'users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'locked_until')
    ah.safe_drop_column(op, conn, 'users', 'failed_login_attempts')
    ah.safe_drop_column(op, conn, 'users', 'token_version')
