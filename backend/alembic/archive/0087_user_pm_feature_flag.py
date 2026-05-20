"""user pm feature flag

Revision ID: 0087_user_pm_feature_flag
Revises: 0086_prj_critical_path
Create Date: 2026-04-30
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

revision = '0087_user_pm_feature_flag'
down_revision = '0086_prj_critical_path'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('can_use_pm_features', sa.Boolean(), nullable=False, server_default=sa.text('false')))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'can_use_pm_features')
