"""Project owner + task required skills (workforce matching).

Revision ID: 0047
Revises: 0046
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
revision = '0047'
down_revision = '0046'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('owner_user_id', postgresql.UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_projects_owner_user_id_users', 'pulse_projects', 'users', ['owner_user_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_projects_owner_user_id', 'pulse_projects', ['owner_user_id'])
    ah.safe_add_column(op, conn, 'pulse_project_tasks', sa.Column('required_skill_names', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'pulse_project_tasks', 'required_skill_names')
    ah.safe_drop_index(op, conn, 'ix_pulse_projects_owner_user_id', 'pulse_projects')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_projects_owner_user_id_users', 'pulse_projects', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'owner_user_id')
