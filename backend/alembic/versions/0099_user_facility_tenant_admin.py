"""Add facility_tenant_admin — in-facility tenant delegate without company_admin role."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0099_user_facility_tenant_admin'
down_revision = '0098_drop_onboarding_columns'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('facility_tenant_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'facility_tenant_admin')
