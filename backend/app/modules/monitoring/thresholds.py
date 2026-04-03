"""Evaluate sensor thresholds after a reading is stored; open or refresh alerts."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitoring_models import (
    AlertSeverity,
    AlertStatus,
    MonitoringAlert,
    Sensor,
    SensorReading,
    SensorThreshold,
)


def _numeric_violation(t: SensorThreshold, value: Decimal) -> bool:
    if t.min_value is not None and value < t.min_value:
        return True
    if t.max_value is not None and value > t.max_value:
        return True
    return False


def _bool_violation(t: SensorThreshold, value: bool) -> bool:
    if t.expected_bool is None:
        return False
    return value != t.expected_bool


def _threshold_triggered(t: SensorThreshold, reading: SensorReading) -> bool:
    if not t.is_active:
        return False
    if reading.value_num is not None and (t.min_value is not None or t.max_value is not None):
        return _numeric_violation(t, reading.value_num)
    if reading.value_bool is not None and t.expected_bool is not None:
        return _bool_violation(t, reading.value_bool)
    return False


def _alert_copy_for_threshold(t: SensorThreshold, reading: SensorReading) -> tuple[str, str, AlertSeverity]:
    label = t.name or "Threshold"
    if reading.value_num is not None:
        msg = f"{label}: value {reading.value_num} outside allowed range."
        sev = AlertSeverity.warning
    elif reading.value_bool is not None:
        msg = f"{label}: boolean value {reading.value_bool} does not match expected {t.expected_bool}."
        sev = AlertSeverity.warning
    else:
        msg = f"{label}: threshold violated."
        sev = AlertSeverity.info
    return (f"Sensor threshold: {label}", msg, sev)


async def evaluate_thresholds_for_reading(
    db: AsyncSession,
    *,
    sensor: Sensor,
    reading: SensorReading,
    company_id: str,
    facility_id: str,
) -> None:
    for t in sensor.thresholds:
        if not _threshold_triggered(t, reading):
            continue
        title, message, severity = _alert_copy_for_threshold(t, reading)
        now = datetime.now(timezone.utc)
        q = await db.execute(
            select(MonitoringAlert).where(
                MonitoringAlert.sensor_id == sensor.id,
                MonitoringAlert.threshold_id == t.id,
                MonitoringAlert.status == AlertStatus.open,
            )
        )
        existing = q.scalar_one_or_none()
        if existing:
            existing.message = message
            existing.updated_at = now
            existing.last_reading_id = reading.id
            existing.severity = severity
        else:
            db.add(
                MonitoringAlert(
                    company_id=company_id,
                    facility_id=facility_id,
                    sensor_id=sensor.id,
                    threshold_id=t.id,
                    severity=severity,
                    status=AlertStatus.open,
                    title=title,
                    message=message,
                    opened_at=now,
                    updated_at=now,
                    last_reading_id=reading.id,
                )
            )
