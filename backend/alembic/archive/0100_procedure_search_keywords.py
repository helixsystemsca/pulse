"""pulse_procedures: internal search_keywords JSON for filtering."""
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
revision = '0100_procedure_search_keywords'
down_revision = '0099_user_facility_tenant_admin'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedures', sa.Column('search_keywords', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'pulse_procedures', 'search_keywords')
