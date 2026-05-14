"""Project creator (for complete action permission).

Revision ID: 0048
Revises: 0047
Create Date: 2026-04-07

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

from sqlalchemy.dialects import postgresql
revision = '0048'
down_revision = '0047'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('created_by_user_id', postgresql.UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_projects_created_by_user_id_users', 'pulse_projects', 'users', ['created_by_user_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_projects_created_by_user_id', 'pulse_projects', ['created_by_user_id'])
    op.execute(sa.text('UPDATE pulse_projects SET created_by_user_id = owner_user_id WHERE created_by_user_id IS NULL AND owner_user_id IS NOT NULL'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_projects_created_by_user_id', 'pulse_projects')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_projects_created_by_user_id_users', 'pulse_projects', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'created_by_user_id')
