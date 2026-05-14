"""Remove per-user onboarding and company demo-sensors flag."""
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
revision = '0098_drop_onboarding_columns'
down_revision = '0097_pm_coordination_layer'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'companies', 'onboarding_demo_sensors')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier2_prompted_at')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_started_at')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier2_enabled')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_tier1_progress')
    ah.safe_drop_column(op, conn, 'users', 'user_onboarding_tour_completed')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_seen')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_steps')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_completed')
    ah.safe_drop_column(op, conn, 'users', 'onboarding_enabled')

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_steps', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_seen', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('user_onboarding_tour_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier1_progress', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier2_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")))
    ah.safe_add_column(op, conn, 'users', sa.Column('onboarding_tier2_prompted_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_add_column(op, conn, 'companies', sa.Column('onboarding_demo_sensors', sa.Boolean(), nullable=False, server_default=sa.false()))
