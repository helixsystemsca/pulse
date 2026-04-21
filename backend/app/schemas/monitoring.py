"""Pydantic models for monitoring API."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.monitoring_models import AlertSeverity, AlertStatus


# --- Facility / zone / system / sensor (CRUD-style for future use) ---


class MonitoringFacilityOut(BaseModel):
    id: str
    company_id: str
    name: str
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class MonitoringZoneOut(BaseModel):
    id: str
    facility_id: str
    parent_zone_id: Optional[str]
    name: str
    code: Optional[str]

    model_config = {"from_attributes": True}


class MonitoredSystemOut(BaseModel):
    id: str
    facility_id: str
    zone_id: Optional[str]
    name: str
    description: Optional[str]

    model_config = {"from_attributes": True}


class SensorOut(BaseModel):
    id: str
    monitored_system_id: str
    zone_id: Optional[str]
    name: str
    external_key: Optional[str]
    unit: Optional[str]
    expected_interval_seconds: int

    model_config = {"from_attributes": True}


class SensorReadingOut(BaseModel):
    id: str
    sensor_id: str
    observed_at: datetime
    value_num: Optional[Decimal]
    value_bool: Optional[bool]
    value_text: Optional[str]
    received_at: datetime

    model_config = {"from_attributes": True}


class SensorThresholdOut(BaseModel):
    id: str
    sensor_id: str
    name: Optional[str]
    min_value: Optional[Decimal]
    max_value: Optional[Decimal]
    expected_bool: Optional[bool]
    is_active: bool
    alert_severity: AlertSeverity

    model_config = {"from_attributes": True}


class MonitoringAlertOut(BaseModel):
    id: str
    company_id: str
    facility_id: str
    sensor_id: str
    threshold_id: Optional[str]
    severity: AlertSeverity
    status: AlertStatus
    title: str
    message: str
    opened_at: datetime
    updated_at: datetime
    last_reading_id: Optional[str]

    model_config = {"from_attributes": True}


# --- Ingest & queries ---


class ReadingBatchItem(BaseModel):
    sensor_id: str = Field(..., description="Monitoring sensor UUID")
    observed_at: datetime
    value_num: Optional[Decimal] = None
    value_bool: Optional[bool] = None
    value_text: Optional[str] = None


class ReadingBatchIn(BaseModel):
    readings: list[ReadingBatchItem] = Field(..., max_length=2000)


class ReadingBatchOut(BaseModel):
    inserted: int
    skipped_invalid_sensor: int


FreshnessLiteral = Literal["live", "delayed", "stale"]


class SensorDetailOut(BaseModel):
    sensor: SensorOut
    latest_reading: Optional[SensorReadingOut]
    freshness: FreshnessLiteral


# --- People monitoring (workforce + XP + tasks) ---


class PeopleTaskMiniOut(BaseModel):
    id: str
    title: str
    status: str
    due_date: Optional[datetime] = None
    priority: int = 1


class PeopleXpMiniOut(BaseModel):
    level: int = 1
    total_xp: int = 0
    into_level: int = 0
    pct: float = 0.0


WorkforceShiftBucket = Literal["day", "afternoon", "night"]


class PeopleMonitorRowOut(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    roles: list[str] = []
    workforce_shift: WorkforceShiftBucket = "day"
    xp: PeopleXpMiniOut
    recent_tasks: list[PeopleTaskMiniOut] = Field(default_factory=list)
