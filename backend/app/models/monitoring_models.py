"""Monitoring / IoT domain: facilities, zones, systems, sensors, readings, thresholds, alerts.

ORM names use a `Monitoring*` prefix where they would collide with existing models (e.g. domain `Zone`).
Conceptual names from the design doc: Facility → MonitoringFacility, Zone → MonitoringZone, Alert → MonitoringAlert.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AlertStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"


class MonitoringFacility(Base):
    """Physical or logical site under a tenant (design: Facility)."""

    __tablename__ = "monitoring_facilities"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    zones: Mapped[list["MonitoringZone"]] = relationship(
        back_populates="facility",
        cascade="all, delete-orphan",
    )
    monitored_systems: Mapped[list["MonitoredSystem"]] = relationship(
        back_populates="facility",
        cascade="all, delete-orphan",
    )


class MonitoringZone(Base):
    """Sub-area within a monitoring facility (design: Zone)."""

    __tablename__ = "monitoring_zones"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    facility_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    facility: Mapped["MonitoringFacility"] = relationship(back_populates="zones")
    parent: Mapped[Optional["MonitoringZone"]] = relationship(
        back_populates="children",
        remote_side=[id],
    )
    children: Mapped[list["MonitoringZone"]] = relationship(
        back_populates="parent",
    )


class MonitoredSystem(Base):
    """Equipment or logical system being monitored."""

    __tablename__ = "monitored_systems"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    facility_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    facility: Mapped["MonitoringFacility"] = relationship(back_populates="monitored_systems")
    zone: Mapped[Optional["MonitoringZone"]] = relationship()
    sensors: Mapped[list["Sensor"]] = relationship(
        back_populates="monitored_system",
        cascade="all, delete-orphan",
    )


class Sensor(Base):
    """Telemetry source."""

    __tablename__ = "monitoring_sensors"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    monitored_system_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitored_systems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    external_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expected_interval_seconds: Mapped[int] = mapped_column(nullable=False, default=300)

    monitored_system: Mapped["MonitoredSystem"] = relationship(back_populates="sensors")
    zone: Mapped[Optional["MonitoringZone"]] = relationship()
    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="sensor",
        cascade="all, delete-orphan",
    )
    thresholds: Mapped[list["SensorThreshold"]] = relationship(
        back_populates="sensor",
        cascade="all, delete-orphan",
    )
    alerts: Mapped[list["MonitoringAlert"]] = relationship(back_populates="sensor")


class SensorReading(Base):
    """Time-series sample; composite uniqueness on (sensor_id, observed_at) for idempotent ingest."""

    __tablename__ = "monitoring_sensor_readings"
    __table_args__ = (
        Index("ix_monitoring_sensor_readings_sensor_observed", "sensor_id", "observed_at"),
        UniqueConstraint("sensor_id", "observed_at", name="uq_monitoring_sensor_reading_sensor_observed"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    sensor_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    value_num: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    value_bool: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    sensor: Mapped["Sensor"] = relationship(back_populates="readings")


class SensorThreshold(Base):
    """Simple bounds / expected value for a sensor."""

    __tablename__ = "monitoring_sensor_thresholds"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    sensor_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    min_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    max_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    expected_bool: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: When this threshold fires, the opened/updated `MonitoringAlert` uses this severity.
    alert_severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, native_enum=False, length=32),
        default=AlertSeverity.warning,
        nullable=False,
    )

    sensor: Mapped["Sensor"] = relationship(back_populates="thresholds")
    alerts: Mapped[list["MonitoringAlert"]] = relationship(back_populates="threshold")


class MonitoringAlert(Base):
    """Threshold violation or operational alert (design: Alert)."""

    __tablename__ = "monitoring_alerts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    facility_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sensor_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    threshold_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_sensor_thresholds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, native_enum=False, length=32),
        default=AlertSeverity.warning,
        nullable=False,
    )
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, native_enum=False, length=32),
        default=AlertStatus.open,
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_reading_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("monitoring_sensor_readings.id", ondelete="SET NULL"),
        nullable=True,
    )

    sensor: Mapped["Sensor"] = relationship(back_populates="alerts")
    threshold: Mapped[Optional["SensorThreshold"]] = relationship(back_populates="alerts")
