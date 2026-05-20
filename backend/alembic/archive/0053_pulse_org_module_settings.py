"""Per-organization unified module settings JSON."""
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0053'
down_revision = '0052'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_org_module_settings', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('settings', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    ah.safe_create_index(op, conn, 'ix_pulse_org_module_settings_company_id', 'pulse_org_module_settings', ['company_id'], unique=True)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_org_module_settings_company_id', 'pulse_org_module_settings')
    ah.safe_drop_table(op, conn, 'pulse_org_module_settings')
