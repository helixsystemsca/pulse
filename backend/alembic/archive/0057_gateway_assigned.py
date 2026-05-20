"""automation_gateways.assigned for plug-and-play onboarding (unassigned pool).

Revision ID: 0057
Revises: 0056
Create Date: 2026-04-10

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

revision = '0057'
down_revision = '0056'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'automation_gateways', sa.Column('assigned', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.execute(sa.text('UPDATE automation_gateways SET assigned = (zone_id IS NOT NULL)'))
    ah.safe_alter_column(op, conn, 'automation_gateways', 'assigned', server_default=None)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'automation_gateways', 'assigned')
