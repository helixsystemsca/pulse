from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    tool_id: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1)
    usage_units_threshold: Optional[int] = Field(None, ge=1)
    next_due_at: Optional[datetime] = None


class MaintenanceConfirm(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000)
    inference_triggered: bool = False
