"""Monitoring: facilities, zones, systems, sensors, readings, thresholds, alerts."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "monitoring_facilities",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_monitoring_facilities_company_id", "monitoring_facilities", ["company_id"])

    op.create_table(
        "monitoring_zones",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(64), nullable=True),
    )
    op.create_index("ix_monitoring_zones_facility_id", "monitoring_zones", ["facility_id"])
    op.create_index("ix_monitoring_zones_parent_zone_id", "monitoring_zones", ["parent_zone_id"])
    op.create_index("ix_monitoring_zones_code", "monitoring_zones", ["code"])

    op.create_table(
        "monitored_systems",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_monitored_systems_facility_id", "monitored_systems", ["facility_id"])
    op.create_index("ix_monitored_systems_zone_id", "monitored_systems", ["zone_id"])

    op.create_table(
        "monitoring_sensors",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "monitored_system_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitored_systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("external_key", sa.String(128), nullable=True),
        sa.Column("unit", sa.String(32), nullable=True),
        sa.Column("expected_interval_seconds", sa.Integer(), nullable=False, server_default="300"),
    )
    op.create_index("ix_monitoring_sensors_monitored_system_id", "monitoring_sensors", ["monitored_system_id"])
    op.create_index("ix_monitoring_sensors_zone_id", "monitoring_sensors", ["zone_id"])
    op.create_index("ix_monitoring_sensors_external_key", "monitoring_sensors", ["external_key"])

    op.create_table(
        "monitoring_sensor_readings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "sensor_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value_num", sa.Numeric(24, 8), nullable=True),
        sa.Column("value_bool", sa.Boolean(), nullable=True),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "sensor_id",
            "observed_at",
            name="uq_monitoring_sensor_reading_sensor_observed",
        ),
    )
    op.create_index(
        "ix_monitoring_sensor_readings_sensor_observed",
        "monitoring_sensor_readings",
        ["sensor_id", "observed_at"],
    )
    op.create_index("ix_monitoring_sensor_readings_sensor_id", "monitoring_sensor_readings", ["sensor_id"])

    op.create_table(
        "monitoring_sensor_thresholds",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "sensor_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("min_value", sa.Numeric(24, 8), nullable=True),
        sa.Column("max_value", sa.Numeric(24, 8), nullable=True),
        sa.Column("expected_bool", sa.Boolean(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_monitoring_sensor_thresholds_sensor_id", "monitoring_sensor_thresholds", ["sensor_id"])

    op.create_table(
        "monitoring_alerts",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sensor_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "threshold_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_sensor_thresholds.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("severity", sa.String(32), nullable=False, server_default="warning"),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "last_reading_id",
            UUID(as_uuid=False),
            sa.ForeignKey("monitoring_sensor_readings.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_monitoring_alerts_company_id", "monitoring_alerts", ["company_id"])
    op.create_index("ix_monitoring_alerts_facility_id", "monitoring_alerts", ["facility_id"])
    op.create_index("ix_monitoring_alerts_sensor_id", "monitoring_alerts", ["sensor_id"])
    op.create_index("ix_monitoring_alerts_threshold_id", "monitoring_alerts", ["threshold_id"])
    op.create_index("ix_monitoring_alerts_status", "monitoring_alerts", ["status"])


def downgrade() -> None:
    op.drop_index("ix_monitoring_alerts_status", table_name="monitoring_alerts")
    op.drop_index("ix_monitoring_alerts_threshold_id", table_name="monitoring_alerts")
    op.drop_index("ix_monitoring_alerts_sensor_id", table_name="monitoring_alerts")
    op.drop_index("ix_monitoring_alerts_facility_id", table_name="monitoring_alerts")
    op.drop_index("ix_monitoring_alerts_company_id", table_name="monitoring_alerts")
    op.drop_table("monitoring_alerts")

    op.drop_index("ix_monitoring_sensor_thresholds_sensor_id", table_name="monitoring_sensor_thresholds")
    op.drop_table("monitoring_sensor_thresholds")

    op.drop_index("ix_monitoring_sensor_readings_sensor_id", table_name="monitoring_sensor_readings")
    op.drop_index("ix_monitoring_sensor_readings_sensor_observed", table_name="monitoring_sensor_readings")
    op.drop_table("monitoring_sensor_readings")

    op.drop_index("ix_monitoring_sensors_external_key", table_name="monitoring_sensors")
    op.drop_index("ix_monitoring_sensors_zone_id", table_name="monitoring_sensors")
    op.drop_index("ix_monitoring_sensors_monitored_system_id", table_name="monitoring_sensors")
    op.drop_table("monitoring_sensors")

    op.drop_index("ix_monitored_systems_zone_id", table_name="monitored_systems")
    op.drop_index("ix_monitored_systems_facility_id", table_name="monitored_systems")
    op.drop_table("monitored_systems")

    op.drop_index("ix_monitoring_zones_code", table_name="monitoring_zones")
    op.drop_index("ix_monitoring_zones_parent_zone_id", table_name="monitoring_zones")
    op.drop_index("ix_monitoring_zones_facility_id", table_name="monitoring_zones")
    op.drop_table("monitoring_zones")

    op.drop_index("ix_monitoring_facilities_company_id", table_name="monitoring_facilities")
    op.drop_table("monitoring_facilities")
