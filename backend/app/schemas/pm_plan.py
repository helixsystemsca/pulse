"""Soft-start PM plan schemas (lightweight recurring PM that generates Work Requests)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

PmFrequency = Literal["daily", "weekly", "monthly", "custom"]


class PmPlanCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    frequency: PmFrequency
    start_date: Optional[date] = None
    due_time_offset_days: Optional[int] = Field(None, ge=0, le=30)
    assigned_to: Optional[str] = None
    custom_interval_days: Optional[int] = Field(None, ge=1, le=365)


class PmPlanOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str] = None
    frequency: PmFrequency
    custom_interval_days: Optional[int] = None
    start_date: date
    due_time_offset_days: Optional[int] = None
    assigned_to: Optional[str] = None
    equipment_id: Optional[str] = None
    template_id: Optional[str] = None
    plan_metadata: dict[str, Any] = {}
    next_due_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PmPlanCreateResultOut(BaseModel):
    plan: PmPlanOut
    generated_work_request_id: str

