"""Soft-delete for product feedback (admin inbox)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0119_pulse_feedback_deleted'
down_revision = '0118_pulse_user_feedback'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_user_feedback', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_user_feedback_company_active', 'pulse_user_feedback', ['company_id'], postgresql_where=sa.text('deleted_at IS NULL'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_user_feedback_company_active', 'pulse_user_feedback')
    ah.safe_drop_column(op, conn, 'pulse_user_feedback', 'deleted_at')
