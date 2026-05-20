"""Add entity_id to domain_events for first-class event model.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-26

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if ah.column_exists(conn, 'domain_events', 'entity_id'):
        return
    ah.safe_add_column(op, conn, 'domain_events', sa.Column('entity_id', sa.String(length=64), nullable=True))
    ah.safe_create_index(op, conn, 'ix_domain_events_entity_id', 'domain_events', ['entity_id'], unique=False)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_domain_events_entity_id', 'domain_events')
    ah.safe_drop_column(op, conn, 'domain_events', 'entity_id')
