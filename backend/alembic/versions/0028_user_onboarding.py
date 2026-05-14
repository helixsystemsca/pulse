"""Per-user onboarding checklist (enabled, completed, steps JSON)."""
from __future__ import annotations
import json
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB
revision = '0028'
down_revision = '0027'
branch_labels = None
depends_on = None
_STEPS = [{'key': 'create_zone', 'completed': False}, {'key': 'add_device', 'completed': False}, {'key': 'create_work_order', 'completed': False}, {'key': 'view_operations', 'completed': False}]
_STEPS_LITERAL = json.dumps(_STEPS)

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_steps', JSONB(), nullable=False, server_default=sa.text(f"'{_STEPS_LITERAL}'::jsonb")))
    op.execute(sa.text('UPDATE users SET onboarding_completed = true, onboarding_enabled = false WHERE true'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'onboarding_steps')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_completed')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_enabled')
