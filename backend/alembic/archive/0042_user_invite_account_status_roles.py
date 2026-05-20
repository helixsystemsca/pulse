"""Users: invite onboarding (account_status, token), nullable password; roles lead & supervisor."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0042'
down_revision = '0041'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('account_status', sa.String(length=16), nullable=False, server_default=sa.text("'active'")))
    ah.safe_add_column(op, conn, 'users', sa.Column('invite_token_hash', sa.String(length=128), nullable=True))
    ah.safe_add_column(op, conn, 'users', sa.Column('invite_expires_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_alter_column(op, conn, 'users', 'hashed_password', existing_type=sa.String(length=255), nullable=True)
    ah.safe_create_index(op, conn, 'ix_users_invite_token_hash', 'users', ['invite_token_hash'], unique=True)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_users_invite_token_hash', 'users')
    ah.safe_alter_column(op, conn, 'users', 'hashed_password', existing_type=sa.String(length=255), nullable=False)
    ah.safe_drop_column(op, conn, 'users', 'invite_expires_at')
    ah.safe_drop_column(op, conn, 'users', 'invite_token_hash')
    ah.safe_drop_column(op, conn, 'users', 'account_status')
