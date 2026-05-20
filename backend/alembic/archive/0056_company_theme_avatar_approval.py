"""company theme/background + avatar approval workflow

Revision ID: 0056
Revises: 0055
Create Date: 2026-04-09

"""
from __future__ import annotations
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = '0056'
down_revision = '0055'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'companies', sa.Column('background_image_url', sa.String(length=2048), nullable=True))
    ah.safe_add_column(op, conn, 'companies', sa.Column('theme', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False))
    ah.safe_add_column(op, conn, 'users', sa.Column('avatar_pending_url', sa.String(length=2048), nullable=True))
    ah.safe_add_column(op, conn, 'users', sa.Column('avatar_status', sa.Enum('approved', 'pending', 'rejected', name='avatarstatus', native_enum=False, length=16), server_default=sa.text("'approved'"), nullable=False))
    op.execute("UPDATE users SET avatar_status = 'approved' WHERE avatar_status IS NULL;")

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'avatar_status')
    ah.safe_drop_column(op, conn, 'users', 'avatar_pending_url')
    ah.safe_drop_column(op, conn, 'companies', 'theme')
    ah.safe_drop_column(op, conn, 'companies', 'background_image_url')
