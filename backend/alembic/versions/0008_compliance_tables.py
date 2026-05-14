"""Compliance rules and acknowledgment records.

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-30

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, 'compliance_rules'):
        ah.safe_create_table(op, conn, 'compliance_rules', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('tool_id', UUID(as_uuid=False), sa.ForeignKey('tools.id', ondelete='CASCADE'), nullable=False), sa.Column('required_sop_id', sa.String(128), nullable=True), sa.Column('sop_label', sa.String(255), nullable=True), sa.Column('time_limit_hours', sa.Integer(), nullable=False, server_default='24'), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_compliance_rules_company_id', 'compliance_rules', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_compliance_rules_tool_id', 'compliance_rules', ['tool_id'])
        ah.safe_create_unique_constraint(op, conn, 'uq_compliance_rules_company_tool', 'compliance_rules', ['company_id', 'tool_id'])
    if not ah.table_exists(conn, 'compliance_records'):
        ah.safe_create_table(op, conn, 'compliance_records', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('tool_id', UUID(as_uuid=False), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True), sa.Column('sop_id', sa.String(128), nullable=True), sa.Column('sop_label', sa.String(255), nullable=True), sa.Column('category', sa.String(32), nullable=False, server_default='procedures'), sa.Column('status', sa.String(32), nullable=False, server_default='pending'), sa.Column('ignored', sa.Boolean(), nullable=False, server_default='false'), sa.Column('flagged', sa.Boolean(), nullable=False, server_default='false'), sa.Column('required_at', sa.DateTime(timezone=True), nullable=False), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('reviewed_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_compliance_records_company_id', 'compliance_records', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_compliance_records_user_id', 'compliance_records', ['user_id'])
        ah.safe_create_index(op, conn, 'ix_compliance_records_tool_id', 'compliance_records', ['tool_id'])
        ah.safe_create_index(op, conn, 'ix_compliance_records_created_at', 'compliance_records', ['created_at'])

def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'compliance_records'):
        ah.safe_drop_table(op, conn, 'compliance_records')
    if ah.table_exists(conn, 'compliance_rules'):
        ah.safe_drop_table(op, conn, 'compliance_rules')
