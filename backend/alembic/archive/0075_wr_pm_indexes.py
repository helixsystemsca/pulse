"""Composite indexes + pm_tasks.company_id for scale

Revision ID: 0075_wr_pm_indexes
Revises: 0074_migrate_prev_to_pm
Create Date: 2026-04-26
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
revision = '0075_wr_pm_indexes'
down_revision = '0074_migrate_prev_to_pm'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_index(op, conn, 'ix_wr_company_status', 'pulse_work_requests', ['company_id', 'status'])
    ah.safe_create_index(op, conn, 'ix_wr_company_assigned', 'pulse_work_requests', ['company_id', 'assigned_user_id'])
    ah.safe_add_column(op, conn, 'pm_tasks', sa.Column('company_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pm_tasks_company_id_companies', 'pm_tasks', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
    op.execute('\n        UPDATE pm_tasks t\n        SET company_id = fe.company_id\n        FROM facility_equipment fe\n        WHERE t.company_id IS NULL\n          AND t.equipment_id IS NOT NULL\n          AND fe.id = t.equipment_id;\n        ')
    op.execute('\n        UPDATE pm_tasks t\n        SET company_id = tl.company_id\n        FROM tools tl\n        WHERE t.company_id IS NULL\n          AND t.tool_id IS NOT NULL\n          AND tl.id = t.tool_id;\n        ')
    ah.safe_alter_column(op, conn, 'pm_tasks', 'company_id', existing_type=UUID(as_uuid=False), nullable=False)
    ah.safe_create_index(op, conn, 'ix_pm_tasks_company_due', 'pm_tasks', ['company_id', 'next_due_at'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pm_tasks_company_due', 'pm_tasks')
    ah.safe_alter_column(op, conn, 'pm_tasks', 'company_id', existing_type=UUID(as_uuid=False), nullable=True)
    ah.safe_drop_constraint(op, conn, 'fk_pm_tasks_company_id_companies', 'pm_tasks', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pm_tasks', 'company_id')
    ah.safe_drop_index(op, conn, 'ix_wr_company_assigned', 'pulse_work_requests')
    ah.safe_drop_index(op, conn, 'ix_wr_company_status', 'pulse_work_requests')
