"""Procedures, preventative rules, work order type + procedure link on pulse_work_requests."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0041'
down_revision = '0040'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_procedures', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('title', sa.String(length=255), nullable=False), sa.Column('steps', JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_procedures_company_id', 'pulse_procedures', ['company_id'])
    ah.safe_create_table(op, conn, 'pulse_preventative_rules', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('equipment_id', UUID(as_uuid=False), nullable=False), sa.Column('frequency', sa.String(length=128), nullable=False), sa.Column('procedure_id', UUID(as_uuid=False), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['equipment_id'], ['facility_equipment.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['procedure_id'], ['pulse_procedures.id'], ondelete='SET NULL'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_preventative_rules_company_id', 'pulse_preventative_rules', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_pulse_preventative_rules_equipment_id', 'pulse_preventative_rules', ['equipment_id'])
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('work_order_type', sa.String(length=16), nullable=False, server_default='issue'))
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('procedure_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_work_order_type', 'pulse_work_requests', ['work_order_type'])
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_procedure_id', 'pulse_work_requests', ['procedure_id'])
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_work_requests_procedure_id', 'pulse_work_requests', 'pulse_procedures', ['procedure_id'], ['id'], ondelete='SET NULL')
    op.execute(sa.text("UPDATE pulse_work_requests SET work_order_type = 'issue' WHERE work_order_type IS NULL"))
    ah.safe_alter_column(op, conn, 'pulse_work_requests', 'work_order_type', server_default=None)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(op, conn, 'fk_pulse_work_requests_procedure_id', 'pulse_work_requests', type_='foreignkey')
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_procedure_id', 'pulse_work_requests')
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_work_order_type', 'pulse_work_requests')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'procedure_id')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'work_order_type')
    ah.safe_drop_index(op, conn, 'ix_pulse_preventative_rules_equipment_id', 'pulse_preventative_rules')
    ah.safe_drop_index(op, conn, 'ix_pulse_preventative_rules_company_id', 'pulse_preventative_rules')
    ah.safe_drop_table(op, conn, 'pulse_preventative_rules')
    ah.safe_drop_index(op, conn, 'ix_pulse_procedures_company_id', 'pulse_procedures')
    ah.safe_drop_table(op, conn, 'pulse_procedures')
