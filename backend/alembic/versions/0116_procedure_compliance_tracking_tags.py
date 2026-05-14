"""Procedure compliance: tracking tags + onboarding scope flag."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB
revision = '0116_procedure_compliance_tracking_tags'
down_revision = '0115_procedure_acknowledgment_snapshots_pdf'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedure_compliance_settings', sa.Column('tracking_tags', JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    ah.safe_add_column(op, conn, 'pulse_procedure_compliance_settings', sa.Column('onboarding_required', sa.Boolean(), nullable=False, server_default=sa.text('false')))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'pulse_procedure_compliance_settings', 'onboarding_required')
    ah.safe_drop_column(op, conn, 'pulse_procedure_compliance_settings', 'tracking_tags')
