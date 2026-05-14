"""Automation device hub: gateways, BLE devices, event company_id, notification company_id, zones.description.

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-30
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
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'automation_events') and (not ah.column_exists(conn, 'automation_events', 'company_id')):
        ah.safe_add_column(op, conn, 'automation_events', sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=True))
        ah.safe_create_index(op, conn, 'ix_automation_events_company_id', 'automation_events', ['company_id'])
    if ah.table_exists(conn, 'automation_notifications') and (not ah.column_exists(conn, 'automation_notifications', 'company_id')):
        ah.safe_add_column(op, conn, 'automation_notifications', sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=True))
        op.execute(text('\n                UPDATE automation_notifications AS an\n                SET company_id = u.company_id\n                FROM users AS u\n                WHERE an.user_id = u.id AND u.company_id IS NOT NULL\n                '))
        op.execute(text('DELETE FROM automation_notifications WHERE company_id IS NULL'))
        op.execute(text('ALTER TABLE automation_notifications ALTER COLUMN company_id SET NOT NULL'))
        ah.safe_create_index(op, conn, 'ix_automation_notifications_company_id', 'automation_notifications', ['company_id'])
    if ah.table_exists(conn, 'zones') and (not ah.column_exists(conn, 'zones', 'description')):
        ah.safe_add_column(op, conn, 'zones', sa.Column('description', sa.Text(), nullable=True))
    if not ah.table_exists(conn, 'automation_gateways'):
        ah.safe_create_table(op, conn, 'automation_gateways', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('identifier', sa.String(128), nullable=False), sa.Column('status', sa.String(32), server_default='offline', nullable=False), sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True), sa.UniqueConstraint('company_id', 'identifier', name='uq_automation_gateway_company_identifier'))
        ah.safe_create_index(op, conn, 'ix_automation_gateways_company_id', 'automation_gateways', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_automation_gateways_identifier', 'automation_gateways', ['identifier'])
        ah.safe_create_index(op, conn, 'ix_automation_gateways_status', 'automation_gateways', ['status'])
        ah.safe_create_index(op, conn, 'ix_automation_gateways_zone_id', 'automation_gateways', ['zone_id'])
    if not ah.table_exists(conn, 'automation_ble_devices'):
        ah.safe_create_table(op, conn, 'automation_ble_devices', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('mac_address', sa.String(32), nullable=False), sa.Column('type', sa.String(32), nullable=False), sa.Column('assigned_worker_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('assigned_equipment_id', UUID(as_uuid=False), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True), sa.UniqueConstraint('company_id', 'mac_address', name='uq_automation_ble_company_mac'))
        ah.safe_create_index(op, conn, 'ix_automation_ble_devices_company_id', 'automation_ble_devices', ['company_id'])
        ah.safe_create_index(op, conn, 'ix_automation_ble_devices_mac_address', 'automation_ble_devices', ['mac_address'])
        ah.safe_create_index(op, conn, 'ix_automation_ble_devices_type', 'automation_ble_devices', ['type'])
        ah.safe_create_index(op, conn, 'ix_automation_ble_devices_assigned_worker_id', 'automation_ble_devices', ['assigned_worker_id'])
        ah.safe_create_index(op, conn, 'ix_automation_ble_devices_assigned_equipment_id', 'automation_ble_devices', ['assigned_equipment_id'])

def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, 'automation_ble_devices'):
        ah.safe_drop_table(op, conn, 'automation_ble_devices')
    if ah.table_exists(conn, 'automation_gateways'):
        ah.safe_drop_table(op, conn, 'automation_gateways')
    if ah.table_exists(conn, 'zones') and ah.column_exists(conn, 'zones', 'description'):
        ah.safe_drop_column(op, conn, 'zones', 'description')
    if ah.table_exists(conn, 'automation_notifications') and ah.column_exists(conn, 'automation_notifications', 'company_id'):
        ah.safe_drop_index(op, conn, 'ix_automation_notifications_company_id', 'automation_notifications')
        ah.safe_drop_constraint(op, conn, 'fk_automation_notifications_company_id', 'automation_notifications', type_='foreignkey')
        ah.safe_drop_column(op, conn, 'automation_notifications', 'company_id')
    if ah.table_exists(conn, 'automation_events') and ah.column_exists(conn, 'automation_events', 'company_id'):
        ah.safe_drop_index(op, conn, 'ix_automation_events_company_id', 'automation_events')
        ah.safe_drop_column(op, conn, 'automation_events', 'company_id')
