"""Material request queue and draft schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MaterialRequestQueueOut(BaseModel):
    id: str
    inventory_item_id: str
    item_name: str
    sku: str
    category: Optional[str] = None
    vendor: Optional[str] = None
    vendor_part_number: Optional[str] = None
    unit: Optional[str] = None
    reimbursable: Optional[bool] = None
    current_qty: float
    minimum_qty: float
    maximum_qty: Optional[float] = None
    reorder_qty: float
    priority_score: float = 0
    days_until_stockout: Optional[float] = None
    urgency_tier: str = "normal"
    anomaly_flag: bool = False
    estimated_unit_cost: Optional[float] = None
    status: str
    exported_at: Optional[datetime] = None
    export_batch_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MaterialRequestQueueListOut(BaseModel):
    items: list[MaterialRequestQueueOut]


class MaterialRequestQueuePatchIn(BaseModel):
    reorder_qty: Optional[float] = Field(None, ge=0)
    reimbursable: Optional[bool] = None
    vendor_part_number: Optional[str] = Field(None, max_length=128)
    unit: Optional[str] = Field(None, max_length=32)


class MaterialRequestQueueExportIn(BaseModel):
    queue_item_ids: list[str] = Field(..., min_length=1)
    project: str = Field(..., min_length=1, max_length=255)
    location: str = Field(..., min_length=1, max_length=512)
    cost_object: Optional[str] = Field(None, max_length=255)
    comments: Optional[str] = Field(None, max_length=4000)
    notify_emails: Optional[list[str]] = Field(
        None,
        description="Recipients to email the exported spreadsheet (must be in tenant notification directory when configured).",
    )


class MaterialRequestExportOut(BaseModel):
    id: str
    project: str
    location: str
    cost_object: Optional[str] = None
    item_count: int
    file_name: str
    created_by_user_id: Optional[str] = None
    created_at: datetime


class MaterialRequestExportListOut(BaseModel):
    items: list[MaterialRequestExportOut]


class MaterialRequestQueueIdsIn(BaseModel):
    queue_item_ids: list[str] = Field(..., min_length=1)


class MaterialRequestCreateDraftIn(BaseModel):
    queue_item_ids: list[str] = Field(..., min_length=1)


class MaterialRequestDraftItemOut(BaseModel):
    id: str
    queue_item_id: Optional[str] = None
    item_name: str
    sku: str
    vendor: Optional[str] = None
    qty_requested: float
    estimated_unit_cost: Optional[float] = None
    estimated_cost: Optional[float] = None


class MaterialRequestDraftOut(BaseModel):
    id: str
    draft_number: str
    created_by_user_id: Optional[str] = None
    created_at: datetime
    status: str
    items: list[MaterialRequestDraftItemOut]
    estimated_total_cost: float


class MaterialRequestDraftCreatedOut(BaseModel):
    draft: MaterialRequestDraftOut
