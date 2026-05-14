"""PM tasks, checklist/parts, work order source + line items for auto PM."""
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
revision = '0062_pm_tasks'
down_revision = '0061_pulse_procedures_wf'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pm_tasks', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('equipment_id', UUID(as_uuid=False), sa.ForeignKey('facility_equipment.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('frequency_type', sa.String(length=16), nullable=False), sa.Column('frequency_value', sa.Integer(), nullable=False), sa.Column('last_completed_at', sa.DateTime(timezone=True), nullable=True), sa.Column('next_due_at', sa.DateTime(timezone=True), nullable=False), sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True), sa.Column('auto_create_work_order', sa.Boolean(), nullable=False, server_default=sa.text('true')), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')), sa.CheckConstraint('frequency_value > 0', name='ck_pm_tasks_frequency_value_pos'), sa.CheckConstraint("frequency_type IN ('days','weeks','months')", name='ck_pm_tasks_frequency_type'))
    ah.safe_create_index(op, conn, 'ix_pm_tasks_equipment_id', 'pm_tasks', ['equipment_id'])
    ah.safe_create_index(op, conn, 'ix_pm_tasks_next_due_at', 'pm_tasks', ['next_due_at'])
    ah.safe_create_table(op, conn, 'pm_task_parts', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('pm_task_id', UUID(as_uuid=False), sa.ForeignKey('pm_tasks.id', ondelete='CASCADE'), nullable=False), sa.Column('part_id', UUID(as_uuid=False), sa.ForeignKey('equipment_parts.id', ondelete='CASCADE'), nullable=False), sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'), sa.UniqueConstraint('pm_task_id', 'part_id', name='uq_pm_task_parts_task_part'), sa.CheckConstraint('quantity > 0', name='ck_pm_task_parts_qty_pos'))
    ah.safe_create_index(op, conn, 'ix_pm_task_parts_pm_task_id', 'pm_task_parts', ['pm_task_id'])
    ah.safe_create_table(op, conn, 'pm_task_checklist_items', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('pm_task_id', UUID(as_uuid=False), sa.ForeignKey('pm_tasks.id', ondelete='CASCADE'), nullable=False), sa.Column('label', sa.String(length=512), nullable=False), sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    ah.safe_create_index(op, conn, 'ix_pm_task_checklist_pm_task_id', 'pm_task_checklist_items', ['pm_task_id'])
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('pm_task_id', UUID(as_uuid=False), sa.ForeignKey('pm_tasks.id', ondelete='SET NULL'), nullable=True))
    ah.safe_add_column(op, conn, 'pulse_work_requests', sa.Column('work_order_source', sa.String(length=32), nullable=False, server_default='manual'))
    ah.safe_create_index(op, conn, 'ix_pulse_work_requests_pm_task_id', 'pulse_work_requests', ['pm_task_id'])
    op.execute("\n        CREATE UNIQUE INDEX uq_pulse_wr_one_open_per_pm_task\n        ON pulse_work_requests (pm_task_id)\n        WHERE pm_task_id IS NOT NULL\n          AND status NOT IN ('completed', 'cancelled')\n        ")
    ah.safe_create_table(op, conn, 'pulse_work_request_parts', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('work_request_id', UUID(as_uuid=False), sa.ForeignKey('pulse_work_requests.id', ondelete='CASCADE'), nullable=False), sa.Column('part_id', UUID(as_uuid=False), sa.ForeignKey('equipment_parts.id', ondelete='CASCADE'), nullable=False), sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'), sa.UniqueConstraint('work_request_id', 'part_id', name='uq_pulse_wr_parts_wr_part'), sa.CheckConstraint('quantity > 0', name='ck_pulse_wr_parts_qty_pos'))
    ah.safe_create_index(op, conn, 'ix_pulse_work_request_parts_wr', 'pulse_work_request_parts', ['work_request_id'])
    ah.safe_create_table(op, conn, 'pulse_work_request_checklist_items', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('work_request_id', UUID(as_uuid=False), sa.ForeignKey('pulse_work_requests.id', ondelete='CASCADE'), nullable=False), sa.Column('label', sa.String(length=512), nullable=False), sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'), sa.Column('is_done', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    ah.safe_create_index(op, conn, 'ix_pulse_wr_checklist_wr', 'pulse_work_request_checklist_items', ['work_request_id'])

def downgrade() -> None:
    conn = op.get_bind()
    op.execute('DROP INDEX IF EXISTS uq_pulse_wr_one_open_per_pm_task')
    ah.safe_drop_index(op, conn, 'ix_pulse_wr_checklist_wr', 'pulse_work_request_checklist_items')
    ah.safe_drop_table(op, conn, 'pulse_work_request_checklist_items')
    ah.safe_drop_index(op, conn, 'ix_pulse_work_request_parts_wr', 'pulse_work_request_parts')
    ah.safe_drop_table(op, conn, 'pulse_work_request_parts')
    ah.safe_drop_index(op, conn, 'ix_pulse_work_requests_pm_task_id', 'pulse_work_requests')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'work_order_source')
    ah.safe_drop_column(op, conn, 'pulse_work_requests', 'pm_task_id')
    ah.safe_drop_index(op, conn, 'ix_pm_task_checklist_pm_task_id', 'pm_task_checklist_items')
    ah.safe_drop_table(op, conn, 'pm_task_checklist_items')
    ah.safe_drop_index(op, conn, 'ix_pm_task_parts_pm_task_id', 'pm_task_parts')
    ah.safe_drop_table(op, conn, 'pm_task_parts')
    ah.safe_drop_index(op, conn, 'ix_pm_tasks_next_due_at', 'pm_tasks')
    ah.safe_drop_index(op, conn, 'ix_pm_tasks_equipment_id', 'pm_tasks')
    ah.safe_drop_table(op, conn, 'pm_tasks')
