from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain import PMFrequency
from app.schemas.common import ORMModel


class PMScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    asset_id: str
    frequency: PMFrequency
    interval_days: int | None = Field(default=None, ge=1, le=3650)
    assigned_to_user_id: str | None = None
    last_completed_at: datetime | None = None
    next_due_at: datetime | None = None


class PMScheduleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    frequency: PMFrequency | None = None
    interval_days: int | None = Field(default=None, ge=1, le=3650)
    assigned_to_user_id: str | None = None
    is_active: bool | None = None
    next_due_at: datetime | None = None
    last_completed_at: datetime | None = None


class PMScheduleOut(ORMModel):
    id: str
    company_id: str
    name: str
    asset_id: str
    frequency: PMFrequency
    interval_days: int | None
    last_completed_at: datetime | None
    next_due_at: datetime | None
    assigned_to_user_id: str | None
    is_active: bool
    created_at: datetime


class PMCompletionOut(ORMModel):
    id: str
    company_id: str
    pm_schedule_id: str
    work_order_id: str | None
    completed_by_user_id: str | None
    completed_at: datetime
    notes: str
