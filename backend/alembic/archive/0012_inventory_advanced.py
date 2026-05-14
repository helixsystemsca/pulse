"""Advanced inventory: item extensions, movements, usage, module settings.

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-03

"""
from pathlib import Path
import sys
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID
_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()

    def addcol(table: str, name: str, col) -> None:
        ah.safe_add_column(op, conn, table, col)
    addcol('inventory_items', 'item_type', sa.Column('item_type', sa.String(32), nullable=False, server_default='part'))
    addcol('inventory_items', 'category', sa.Column('category', sa.String(128), nullable=True))
    addcol('inventory_items', 'inv_status', sa.Column('inv_status', sa.String(32), nullable=False, server_default='in_stock'))
    addcol('inventory_items', 'zone_id', sa.Column('zone_id', UUID(as_uuid=False), nullable=True))
    addcol('inventory_items', 'assigned_user_id', sa.Column('assigned_user_id', UUID(as_uuid=False), nullable=True))
    addcol('inventory_items', 'linked_tool_id', sa.Column('linked_tool_id', UUID(as_uuid=False), nullable=True))
    addcol('inventory_items', 'item_condition', sa.Column('item_condition', sa.String(32), nullable=False, server_default='good'))
    addcol('inventory_items', 'reorder_flag', sa.Column('reorder_flag', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    addcol('inventory_items', 'unit_cost', sa.Column('unit_cost', sa.Float(), nullable=True))
    addcol('inventory_items', 'last_movement_at', sa.Column('last_movement_at', sa.DateTime(timezone=True), nullable=True))

    def fk_named(conn2, name: str) -> bool:
        r = conn2.execute(text('SELECT 1 FROM pg_constraint WHERE conname = :n LIMIT 1'), {'n': name})
        return r.first() is not None
    if ah.column_exists(conn, 'inventory_items', 'zone_id') and (not fk_named(conn, 'fk_inventory_items_zone_id')):
        ah.safe_create_foreign_key(op, conn, 'fk_inventory_items_zone_id', 'inventory_items', 'zones', ['zone_id'], ['id'], ondelete='SET NULL')
    if ah.column_exists(conn, 'inventory_items', 'assigned_user_id') and (not fk_named(conn, 'fk_inventory_items_assigned_user_id')):
        ah.safe_create_foreign_key(op, conn, 'fk_inventory_items_assigned_user_id', 'inventory_items', 'users', ['assigned_user_id'], ['id'], ondelete='SET NULL')
    if ah.column_exists(conn, 'inventory_items', 'linked_tool_id') and (not fk_named(conn, 'fk_inventory_items_linked_tool_id')):
        ah.safe_create_foreign_key(op, conn, 'fk_inventory_items_linked_tool_id', 'inventory_items', 'tools', ['linked_tool_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_inventory_items_inv_status', 'inventory_items', ['inv_status'])
    if not ah.table_exists(conn, 'inventory_movements'):
        ah.safe_create_table(op, conn, 'inventory_movements', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('item_id', UUID(as_uuid=False), sa.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False), sa.Column('action', sa.String(32), nullable=False), sa.Column('performed_by', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True), sa.Column('quantity', sa.Float(), nullable=True), sa.Column('work_request_id', UUID(as_uuid=False), sa.ForeignKey('pulse_work_requests.id', ondelete='SET NULL'), nullable=True), sa.Column('meta', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_inventory_movements_company_id', 'inventory_movements', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_inventory_movements_item_id', 'inventory_movements', ['item_id'])
    if not ah.table_exists(conn, 'inventory_usage'):
        ah.safe_create_table(op, conn, 'inventory_usage', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('item_id', UUID(as_uuid=False), sa.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False), sa.Column('work_request_id', UUID(as_uuid=False), sa.ForeignKey('pulse_work_requests.id', ondelete='CASCADE'), nullable=False), sa.Column('quantity', sa.Float(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_inventory_usage_company_id', 'inventory_usage', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_inventory_usage_item_id', 'inventory_usage', ['item_id'])
    if not ah.table_exists(conn, 'inventory_module_settings'):
        ah.safe_create_table(op, conn, 'inventory_module_settings', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('settings', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
        ah.safe_create_index(op, conn, 'ix_inventory_module_settings_company_id', 'inventory_module_settings', ['company_id'], unique=True)
    ah.safe_alter_column_drop_server_default(op, conn, 'inventory_items', 'item_type')
    ah.safe_alter_column_drop_server_default(op, conn, 'inventory_items', 'inv_status')
    ah.safe_alter_column_drop_server_default(op, conn, 'inventory_items', 'item_condition')
    ah.safe_alter_column_drop_server_default(op, conn, 'inventory_items', 'reorder_flag')

def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'inventory_module_settings'):
        ah.safe_drop_table(op, conn, 'inventory_module_settings')
    if ah.table_exists(conn, 'inventory_usage'):
        ah.safe_drop_table(op, conn, 'inventory_usage')
    if ah.table_exists(conn, 'inventory_movements'):
        ah.safe_drop_table(op, conn, 'inventory_movements')
    for col in ('last_movement_at', 'unit_cost', 'reorder_flag', 'item_condition', 'linked_tool_id', 'assigned_user_id', 'zone_id', 'inv_status', 'category', 'item_type'):
        if ah.column_exists(conn, 'inventory_items', col):
            ah.safe_drop_column(op, conn, 'inventory_items', col)
