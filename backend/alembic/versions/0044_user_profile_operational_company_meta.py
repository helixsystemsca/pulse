"""user profile avatar/job_title/operational_role; company timezone/industry

Revision ID: 0044
Revises: 0043
Create Date: 2026-04-04

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
revision = '0044'
down_revision = '0043'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('avatar_url', sa.String(length=2048), nullable=True))
    ah.safe_add_column(op, conn, 'users', sa.Column('job_title', sa.String(length=255), nullable=True))
    ah.safe_add_column(op, conn, 'users', sa.Column('operational_role', sa.String(length=32), nullable=True))
    ah.safe_add_column(op, conn, 'companies', sa.Column('timezone', sa.String(length=128), nullable=True))
    ah.safe_add_column(op, conn, 'companies', sa.Column('industry', sa.String(length=255), nullable=True))
    op.execute("\n        UPDATE users\n        SET operational_role = CASE\n            WHEN roles && ARRAY['manager', 'company_admin']::varchar[] THEN 'manager'\n            WHEN roles && ARRAY['supervisor']::varchar[] THEN 'supervisor'\n            WHEN roles && ARRAY['worker', 'lead']::varchar[] THEN 'worker'\n            ELSE NULL\n        END\n        WHERE company_id IS NOT NULL\n          AND (\n            roles && ARRAY['worker', 'lead', 'supervisor', 'manager', 'company_admin']::varchar[]\n          );\n        ")

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'companies', 'industry')
    ah.safe_drop_column(op, conn, 'companies', 'timezone')
    ah.safe_drop_column(op, conn, 'users', 'operational_role')
    ah.safe_drop_column(op, conn, 'users', 'job_title')
    ah.safe_drop_column(op, conn, 'users', 'avatar_url')
