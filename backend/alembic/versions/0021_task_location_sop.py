"""Project tasks: location_tag_id (BLE/equipment), sop_id (SOP link)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('location_tag_id', sa.String(128), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('sop_id', sa.String(128), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_project_tasks_company_location_tag', 'pulse_project_tasks', ['company_id', 'location_tag_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_tasks_company_location_tag', 'pulse_project_tasks')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'sop_id')
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'location_tag_id')
