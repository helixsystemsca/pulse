"""Schemas for `/api/work-requests` (rich list + detail + settings)."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.pulse_models import PulseWorkRequestPriority, PulseWorkRequestStatus


class WorkRequestCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    user_name: Optional[str] = None
    message: str
    created_at: datetime


class WorkRequestActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    action: str
    performed_by: Optional[str] = None
    performer_name: Optional[str] = None
    meta: dict[str, Any]
    created_at: datetime


class WorkRequestRowOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str]
    tool_id: Optional[str]
    asset_name: Optional[str]
    asset_tag: Optional[str] = None
    zone_id: Optional[str]
    location_name: Optional[str]
    category: Optional[str]
    priority: str
    status: str
    display_status: str
    assigned_user_id: Optional[str]
    assignee_name: Optional[str]
    assignee_email: Optional[str] = None
    due_date: Optional[datetime]
    is_overdue: bool
    completed_at: Optional[datetime]
    created_by_user_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class WorkRequestListOut(BaseModel):
    items: list[WorkRequestRowOut]
    total: int
    overdue_critical_count: int = 0


class WorkRequestDetailOut(WorkRequestRowOut):
    attachments: list[Any]
    comments: list[WorkRequestCommentOut]
    activity: list[WorkRequestActivityOut]


class WorkRequestCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    tool_id: Optional[str] = None
    zone_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=128)
    priority: PulseWorkRequestPriority = PulseWorkRequestPriority.medium
    assigned_user_id: Optional[str] = None
    due_date: Optional[datetime] = None
    attachments: Optional[list[Any]] = None


class WorkRequestPatchIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    tool_id: Optional[str] = None
    zone_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=128)
    priority: Optional[PulseWorkRequestPriority] = None
    status: Optional[PulseWorkRequestStatus] = None
    assigned_user_id: Optional[str] = None
    due_date: Optional[datetime] = None
    attachments: Optional[list[Any]] = None


class WorkRequestCommentIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class WorkRequestAssignIn(BaseModel):
    user_id: Optional[str] = None


class WorkRequestStatusIn(BaseModel):
    status: PulseWorkRequestStatus


class WorkRequestSettingsOut(BaseModel):
    settings: dict[str, Any]


class WorkRequestSettingsPatchIn(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)
