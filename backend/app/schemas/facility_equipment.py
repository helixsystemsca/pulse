"""Pydantic schemas for facility equipment registry API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class EquipmentLinkedWorkOrderOut(BaseModel):
    id: str
    title: str
    status: str
    updated_at: datetime


class FacilityEquipmentOut(BaseModel):
    id: str
    company_id: str
    name: str
    type: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    status: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    service_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    notes: Optional[str] = None
    image_url: Optional[str] = None
    parts_overdue_count: int = 0
    parts_due_soon_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FacilityEquipmentDetailOut(FacilityEquipmentOut):
    related_work_orders: list[EquipmentLinkedWorkOrderOut] = []
    parts_needs_maintenance: bool = False


class FacilityEquipmentCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default="General", max_length=128)
    zone_id: Optional[str] = None
    status: str = Field(default="active", pattern="^(active|maintenance|offline)$")
    manufacturer: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=255)
    serial_number: Optional[str] = Field(None, max_length=255)
    installation_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    service_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    notes: Optional[str] = None


class FacilityEquipmentPatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = Field(None, max_length=128)
    zone_id: Optional[str] = None
    status: Optional[str] = None
    manufacturer: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=255)
    serial_number: Optional[str] = Field(None, max_length=255)
    installation_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    service_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    notes: Optional[str] = None
