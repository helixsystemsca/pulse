"""pulse_worker_profiles.scheduling JSON for employment type + recurring shift templates

Revision ID: 0055
Revises: 0054
Create Date: 2026-04-08

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB
revision: str = '0055'
down_revision: Union[str, None] = '0054'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_worker_profiles', sa.Column('scheduling', JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'pulse_worker_profiles', 'scheduling')
