"""Pydantic schemas for equipment parts (master parts list)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class EquipmentPartOut(BaseModel):
    id: str
    company_id: str
    equipment_id: str
    name: str
    description: Optional[str] = None
    quantity: int
    replacement_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    last_replaced_date: Optional[date] = None
    next_replacement_date: Optional[date] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    maintenance_status: str = Field(description="ok | due_soon | overdue")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EquipmentPartCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quantity: int = Field(default=1, ge=0, le=1_000_000)
    replacement_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    last_replaced_date: Optional[date] = None
    next_replacement_date: Optional[date] = None
    notes: Optional[str] = None


class EquipmentPartPatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=0, le=1_000_000)
    replacement_interval_days: Optional[int] = Field(None, ge=1, le=36500)
    last_replaced_date: Optional[date] = None
    next_replacement_date: Optional[date] = None
    notes: Optional[str] = None


class EquipmentImageUploadOut(BaseModel):
    image_url: str


class EquipmentPartImageUploadOut(BaseModel):
    image_url: str
