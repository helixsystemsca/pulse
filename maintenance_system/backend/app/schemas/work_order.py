from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain import Priority, WorkOrderStatus
from app.schemas.common import ORMModel


class WorkOrderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    priority: Priority = Priority.medium
    due_date: datetime | None = None
    location: str = Field(default="", max_length=512)
    asset_id: str | None = None
    assigned_to_user_id: str | None = None
    source_request_id: str | None = None


class WorkOrderUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    priority: Priority | None = None
    due_date: datetime | None = None
    location: str | None = None
    asset_id: str | None = None


class WorkOrderAssign(BaseModel):
    assigned_to_user_id: str | None = None


class WorkOrderStatusUpdate(BaseModel):
    status: WorkOrderStatus


class WorkOrderNoteCreate(BaseModel):
    body: str = Field(min_length=1)


class WorkOrderAttachmentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=512)
    content_type: str = Field(default="application/octet-stream", max_length=128)


class WorkOrderNoteOut(ORMModel):
    id: str
    company_id: str
    work_order_id: str
    author_user_id: str
    body: str
    created_at: datetime


class WorkOrderAttachmentOut(ORMModel):
    id: str
    company_id: str
    work_order_id: str
    uploaded_by_user_id: str
    filename: str
    content_type: str
    storage_uri: str
    created_at: datetime


class WorkOrderOut(ORMModel):
    id: str
    company_id: str
    work_order_number: str
    title: str
    description: str
    status: WorkOrderStatus
    priority: Priority
    due_date: datetime | None
    location: str
    asset_id: str | None
    assigned_to_user_id: str | None
    source_request_id: str | None
    source_pm_schedule_id: str | None
    created_by_user_id: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime


class WorkOrderDetail(WorkOrderOut):
    notes: list[WorkOrderNoteOut] = []
    attachments: list[WorkOrderAttachmentOut] = []
