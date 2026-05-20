"""project completed_at timestamp

Revision ID: 0090_prj_completed_at
Revises: 0089_prj_materials_repop
Create Date: 2026-04-30
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

revision = '0090_prj_completed_at'
down_revision = '0089_prj_materials_repop'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_projects_completed_at', 'pulse_projects', ['completed_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_projects_completed_at', 'pulse_projects')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'completed_at')
