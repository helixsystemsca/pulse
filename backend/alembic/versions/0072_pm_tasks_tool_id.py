"""pm_tasks: add tool_id FK (dual-track assets)

Revision ID: 0072_pm_tasks_tool_id
Revises: 0071_maint_inf_created_at_idx
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
revision = '0072_pm_tasks_tool_id'
down_revision = '0071_maint_inf_created_at_idx'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pm_tasks', sa.Column('tool_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pm_tasks_tool_id_tools', 'pm_tasks', 'tools', ['tool_id'], ['id'], ondelete='CASCADE')
    ah.safe_create_index(op, conn, 'ix_pm_tasks_tool_id', 'pm_tasks', ['tool_id'])
    ah.safe_alter_column(op, conn, 'pm_tasks', 'equipment_id', existing_type=UUID(as_uuid=False), nullable=True)
    ah.safe_create_check_constraint(op, conn, 'ck_pm_tasks_one_asset', 'pm_tasks', '(equipment_id IS NOT NULL AND tool_id IS NULL) OR (equipment_id IS NULL AND tool_id IS NOT NULL)')

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(op, conn, 'ck_pm_tasks_one_asset', 'pm_tasks', type_='check')
    ah.safe_alter_column(op, conn, 'pm_tasks', 'equipment_id', existing_type=UUID(as_uuid=False), nullable=False)
    ah.safe_drop_index(op, conn, 'ix_pm_tasks_tool_id', 'pm_tasks')
    ah.safe_drop_constraint(op, conn, 'fk_pm_tasks_tool_id_tools', 'pm_tasks', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pm_tasks', 'tool_id')
