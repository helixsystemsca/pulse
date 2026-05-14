"""project categories

Revision ID: 0085_project_categories
Revises: 0084_prj_templates
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

from sqlalchemy.dialects.postgresql import UUID
revision = '0085_project_categories'
down_revision = '0084_prj_templates'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_categories', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(128), nullable=False), sa.Column('color', sa.String(64), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False), sa.UniqueConstraint('company_id', 'name', name='uq_pulse_category_company_name'))
    ah.safe_create_index(op, conn, 'ix_pulse_categories_company_id', 'pulse_categories', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_categories_name', 'pulse_categories', ['name'])
    ah.safe_add_column(op, conn, 'pulse_projects', sa.Column('category_id', UUID(as_uuid=False), sa.ForeignKey('pulse_categories.id', ondelete='SET NULL'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_projects_category_id', 'pulse_projects', ['category_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_projects_category_id', 'pulse_projects')
    ah.safe_drop_column(op, conn, 'pulse_projects', 'category_id')
    ah.safe_drop_index(op, conn, 'ix_pulse_categories_name', 'pulse_categories')
    ah.safe_drop_index(op, conn, 'ix_pulse_categories_company_id', 'pulse_categories')
    ah.safe_drop_table(op, conn, 'pulse_categories')
