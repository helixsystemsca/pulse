"""Scope infra graph and blueprints to pulse_projects.

Revision ID: 0095_drawings_project_scope
Revises: 0094_infra_attr_key_uq
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
revision = '0095_drawings_project_scope'
down_revision = '0094_infra_attr_key_uq'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'infra_assets', sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_infra_assets_company_project', 'infra_assets', ['company_id', 'project_id'])
    ah.safe_add_column(op, conn, 'infra_connections', sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_infra_conn_company_project', 'infra_connections', ['company_id', 'project_id'])
    ah.safe_add_column(op, conn, 'blueprints', sa.Column('project_id', UUID(as_uuid=False), sa.ForeignKey('pulse_projects.id', ondelete='CASCADE'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_blueprints_company_project', 'blueprints', ['company_id', 'project_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_blueprints_company_project', 'blueprints')
    ah.safe_drop_column(op, conn, 'blueprints', 'project_id')
    ah.safe_drop_index(op, conn, 'ix_infra_conn_company_project', 'infra_connections')
    ah.safe_drop_column(op, conn, 'infra_connections', 'project_id')
    ah.safe_drop_index(op, conn, 'ix_infra_assets_company_project', 'infra_assets')
    ah.safe_drop_column(op, conn, 'infra_assets', 'project_id')
