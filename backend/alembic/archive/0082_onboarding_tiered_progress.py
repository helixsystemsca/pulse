"""tiered onboarding progress and unlock flags

Revision ID: 0082_onboarding_tiered_progress
Revises: 0081_soft_start_pm_plans
Create Date: 2026-04-29
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

from sqlalchemy.dialects import postgresql
revision = '0082_onboarding_tiered_progress'
down_revision = '0081_soft_start_pm_plans'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier1_progress', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier2_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier2_prompted_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier2_prompted_at')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_started_at')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier2_enabled')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier1_progress')
