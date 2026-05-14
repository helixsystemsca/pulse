"""Owning department slug for inventory items (workspace / org chart)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0122_inv_item_dept_slug'
down_revision = '0121_worker_hr_dept_slugs'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'inventory_items', sa.Column('department_slug', sa.String(length=32), nullable=False, server_default='maintenance'))
    ah.safe_create_index(op, conn, 'ix_inventory_items_company_department_slug', 'inventory_items', ['company_id', 'department_slug'], unique=False)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_inventory_items_company_department_slug', 'inventory_items')
    ah.safe_drop_column(op, conn, 'inventory_items', 'department_slug')
