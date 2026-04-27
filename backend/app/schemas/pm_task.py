"""Preventive maintenance task API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PmTaskPartLineIn(BaseModel):
    part_id: str
    quantity: int = Field(default=1, ge=1)


class PmTaskChecklistIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=512)
    sort_order: int = Field(default=0, ge=0, le=100000)


class PmTaskCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=8000)
    frequency_type: str = Field(..., description="days | weeks | months")
    frequency_value: int = Field(..., ge=1, le=3650)
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, le=24 * 60)
    auto_create_work_order: bool = True
    parts: list[PmTaskPartLineIn] = Field(default_factory=list)
    checklist: list[PmTaskChecklistIn] = Field(default_factory=list)


class PmTaskOut(BaseModel):
    id: str
    asset_id: str = Field(..., description="facility_equipment.id or tools.id")
    equipment_id: Optional[str] = Field(None, description="facility_equipment.id (fixed asset)")
    tool_id: Optional[str] = Field(None, description="tools.id (BLE-tracked tool/equipment)")
    name: str
    description: Optional[str] = None
    frequency_type: str
    frequency_value: int
    last_completed_at: Optional[datetime] = None
    next_due_at: datetime
    estimated_duration_minutes: Optional[int] = None
    auto_create_work_order: bool
    parts_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PmDueScanResultOut(BaseModel):
    work_orders_created: int
