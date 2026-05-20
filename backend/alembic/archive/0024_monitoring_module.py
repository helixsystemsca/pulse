"""Monitoring: facilities, zones, systems, sensors, readings, thresholds, alerts."""
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
revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'monitoring_facilities', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    ah.safe_create_index(op, conn, 'ix_monitoring_facilities_company_id', 'monitoring_facilities', ['company_id'])
    ah.safe_create_table(op, conn, 'monitoring_zones', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('facility_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_facilities.id', ondelete='CASCADE'), nullable=False), sa.Column('parent_zone_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_zones.id', ondelete='SET NULL'), nullable=True), sa.Column('name', sa.String(255), nullable=False), sa.Column('code', sa.String(64), nullable=True))
    ah.safe_create_index(op, conn, 'ix_monitoring_zones_facility_id', 'monitoring_zones', ['facility_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_zones_parent_zone_id', 'monitoring_zones', ['parent_zone_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_zones_code', 'monitoring_zones', ['code'])
    ah.safe_create_table(op, conn, 'monitored_systems', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('facility_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_facilities.id', ondelete='CASCADE'), nullable=False), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_zones.id', ondelete='SET NULL'), nullable=True), sa.Column('name', sa.String(255), nullable=False), sa.Column('description', sa.Text(), nullable=True))
    ah.safe_create_index(op, conn, 'ix_monitored_systems_facility_id', 'monitored_systems', ['facility_id'])
    ah.safe_create_index(op, conn, 'ix_monitored_systems_zone_id', 'monitored_systems', ['zone_id'])
    ah.safe_create_table(op, conn, 'monitoring_sensors', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('monitored_system_id', UUID(as_uuid=False), sa.ForeignKey('monitored_systems.id', ondelete='CASCADE'), nullable=False), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_zones.id', ondelete='SET NULL'), nullable=True), sa.Column('name', sa.String(255), nullable=False), sa.Column('external_key', sa.String(128), nullable=True), sa.Column('unit', sa.String(32), nullable=True), sa.Column('expected_interval_seconds', sa.Integer(), nullable=False, server_default='300'))
    ah.safe_create_index(op, conn, 'ix_monitoring_sensors_monitored_system_id', 'monitoring_sensors', ['monitored_system_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_sensors_zone_id', 'monitoring_sensors', ['zone_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_sensors_external_key', 'monitoring_sensors', ['external_key'])
    ah.safe_create_table(op, conn, 'monitoring_sensor_readings', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('sensor_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_sensors.id', ondelete='CASCADE'), nullable=False), sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False), sa.Column('value_num', sa.Numeric(24, 8), nullable=True), sa.Column('value_bool', sa.Boolean(), nullable=True), sa.Column('value_text', sa.Text(), nullable=True), sa.Column('received_at', sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint('sensor_id', 'observed_at', name='uq_monitoring_sensor_reading_sensor_observed'))
    ah.safe_create_index(op, conn, 'ix_monitoring_sensor_readings_sensor_observed', 'monitoring_sensor_readings', ['sensor_id', 'observed_at'])
    ah.safe_create_index(op, conn, 'ix_monitoring_sensor_readings_sensor_id', 'monitoring_sensor_readings', ['sensor_id'])
    ah.safe_create_table(op, conn, 'monitoring_sensor_thresholds', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('sensor_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_sensors.id', ondelete='CASCADE'), nullable=False), sa.Column('name', sa.String(255), nullable=True), sa.Column('min_value', sa.Numeric(24, 8), nullable=True), sa.Column('max_value', sa.Numeric(24, 8), nullable=True), sa.Column('expected_bool', sa.Boolean(), nullable=True), sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    ah.safe_create_index(op, conn, 'ix_monitoring_sensor_thresholds_sensor_id', 'monitoring_sensor_thresholds', ['sensor_id'])
    ah.safe_create_table(op, conn, 'monitoring_alerts', sa.Column('id', UUID(as_uuid=False), primary_key=True), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False), sa.Column('facility_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_facilities.id', ondelete='CASCADE'), nullable=False), sa.Column('sensor_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_sensors.id', ondelete='CASCADE'), nullable=False), sa.Column('threshold_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_sensor_thresholds.id', ondelete='SET NULL'), nullable=True), sa.Column('severity', sa.String(32), nullable=False, server_default='warning'), sa.Column('status', sa.String(32), nullable=False, server_default='open'), sa.Column('title', sa.String(512), nullable=False), sa.Column('message', sa.Text(), nullable=False), sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False), sa.Column('last_reading_id', UUID(as_uuid=False), sa.ForeignKey('monitoring_sensor_readings.id', ondelete='SET NULL'), nullable=True))
    ah.safe_create_index(op, conn, 'ix_monitoring_alerts_company_id', 'monitoring_alerts', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_alerts_facility_id', 'monitoring_alerts', ['facility_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_alerts_sensor_id', 'monitoring_alerts', ['sensor_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_alerts_threshold_id', 'monitoring_alerts', ['threshold_id'])
    ah.safe_create_index(op, conn, 'ix_monitoring_alerts_status', 'monitoring_alerts', ['status'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_monitoring_alerts_status', 'monitoring_alerts')
    ah.safe_drop_index(op, conn, 'ix_monitoring_alerts_threshold_id', 'monitoring_alerts')
    ah.safe_drop_index(op, conn, 'ix_monitoring_alerts_sensor_id', 'monitoring_alerts')
    ah.safe_drop_index(op, conn, 'ix_monitoring_alerts_facility_id', 'monitoring_alerts')
    ah.safe_drop_index(op, conn, 'ix_monitoring_alerts_company_id', 'monitoring_alerts')
    ah.safe_drop_table(op, conn, 'monitoring_alerts')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensor_thresholds_sensor_id', 'monitoring_sensor_thresholds')
    ah.safe_drop_table(op, conn, 'monitoring_sensor_thresholds')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensor_readings_sensor_id', 'monitoring_sensor_readings')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensor_readings_sensor_observed', 'monitoring_sensor_readings')
    ah.safe_drop_table(op, conn, 'monitoring_sensor_readings')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensors_external_key', 'monitoring_sensors')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensors_zone_id', 'monitoring_sensors')
    ah.safe_drop_index(op, conn, 'ix_monitoring_sensors_monitored_system_id', 'monitoring_sensors')
    ah.safe_drop_table(op, conn, 'monitoring_sensors')
    ah.safe_drop_index(op, conn, 'ix_monitored_systems_zone_id', 'monitored_systems')
    ah.safe_drop_index(op, conn, 'ix_monitored_systems_facility_id', 'monitored_systems')
    ah.safe_drop_table(op, conn, 'monitored_systems')
    ah.safe_drop_index(op, conn, 'ix_monitoring_zones_code', 'monitoring_zones')
    ah.safe_drop_index(op, conn, 'ix_monitoring_zones_parent_zone_id', 'monitoring_zones')
    ah.safe_drop_index(op, conn, 'ix_monitoring_zones_facility_id', 'monitoring_zones')
    ah.safe_drop_table(op, conn, 'monitoring_zones')
    ah.safe_drop_index(op, conn, 'ix_monitoring_facilities_company_id', 'monitoring_facilities')
    ah.safe_drop_table(op, conn, 'monitoring_facilities')
