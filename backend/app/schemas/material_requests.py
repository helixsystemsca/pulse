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
    current_qty: float
    minimum_qty: float
    maximum_qty: Optional[float] = None
    reorder_qty: float
    estimated_unit_cost: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: datetime


class MaterialRequestQueueListOut(BaseModel):
    items: list[MaterialRequestQueueOut]


class MaterialRequestQueuePatchIn(BaseModel):
    reorder_qty: Optional[float] = Field(None, ge=0)


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
