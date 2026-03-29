from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain import Priority, RequestStatus
from app.schemas.common import ORMModel


class WorkRequestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    priority: Priority = Priority.medium
    location: str = Field(default="", max_length=512)
    asset_id: str | None = None


class WorkRequestUpdateStatus(BaseModel):
    status: RequestStatus
    rejected_reason: str | None = None


class WorkRequestConvert(BaseModel):
    assigned_to_user_id: str | None = None
    due_date: datetime | None = None


class WorkRequestOut(ORMModel):
    id: str
    company_id: str
    title: str
    description: str
    priority: Priority
    location: str
    asset_id: str | None
    requested_by_user_id: str
    status: RequestStatus
    rejected_reason: str | None
    created_at: datetime
    updated_at: datetime
