"""Drop payment_methods and invoices (billing feature removed).

Revision ID: 0026
Revises: 0025
Create Date: 2026-03-30

"""
from pathlib import Path
import sys
from alembic import op
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0026'
down_revision = '0025'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'invoices'):
        ah.safe_drop_table(op, conn, 'invoices')
    if ah.table_exists(conn, 'payment_methods'):
        ah.safe_drop_table(op, conn, 'payment_methods')

def downgrade() -> None:
    conn = op.get_bind()
    'Billing tables are intentionally not recreated; use git history + migration 0009 if needed.'
