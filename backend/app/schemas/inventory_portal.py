"""Schemas for `/api/inventory` (Pulse advanced inventory)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class InventorySummaryOut(BaseModel):
    total_items: int
    in_stock: int
    low_stock: int
    assigned: int
    missing: int
    maintenance: int
    estimated_value: Optional[float] = None


class InventoryMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    action: str
    performed_by: Optional[str] = None
    performer_name: Optional[str] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    quantity: Optional[float] = None
    work_request_id: Optional[str] = None
    work_request_label: Optional[str] = None
    meta: dict[str, Any] = {}
    created_at: datetime


class InventoryUsageOut(BaseModel):
    id: str
    work_request_id: str
    work_request_title: Optional[str] = None
    quantity: float
    created_at: datetime


class InventoryRowOut(BaseModel):
    id: str
    sku: str
    name: str
    item_type: str
    category: Optional[str] = None
    inv_status: str
    quantity: float
    unit: str
    low_stock_threshold: float
    assigned_user_id: Optional[str] = None
    assignee_name: Optional[str] = None
    zone_id: Optional[str] = None
    location_name: Optional[str] = None
    linked_tool_id: Optional[str] = None
    linked_asset_name: Optional[str] = None
    condition: str
    reorder_flag: bool
    last_movement_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    usage_count: int
    unit_cost: Optional[float] = None
    vendor: Optional[str] = None


class InventoryDetailOut(InventoryRowOut):
    movements: list[InventoryMovementOut] = []
    usage: list[InventoryUsageOut] = []
    linked_work_requests: list[dict[str, str]] = []


class InventoryListOut(BaseModel):
    items: list[InventoryRowOut]
    total: int
    summary: InventorySummaryOut


class InventoryCreateIn(BaseModel):
    sku: Optional[str] = Field(None, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    item_type: str = Field("part", pattern="^(tool|part|consumable)$")
    category: Optional[str] = Field(None, max_length=128)
    quantity: float = Field(0, ge=0)
    unit: str = Field("count", max_length=32)
    low_stock_threshold: float = Field(0, ge=0)
    inv_status: Optional[str] = None
    zone_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    linked_tool_id: Optional[str] = None
    condition: str = Field("good", pattern="^(good|needs_maintenance|critical)$")
    unit_cost: Optional[float] = Field(None, ge=0)
    vendor: Optional[str] = Field(None, max_length=255)
    reorder_flag: bool = False


class InventoryPatchIn(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    item_type: Optional[str] = Field(None, pattern="^(tool|part|consumable)$")
    category: Optional[str] = Field(None, max_length=128)
    quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=32)
    low_stock_threshold: Optional[float] = Field(None, ge=0)
    inv_status: Optional[str] = None
    zone_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    linked_tool_id: Optional[str] = None
    condition: Optional[str] = Field(None, pattern="^(good|needs_maintenance|critical)$")
    unit_cost: Optional[float] = Field(None, ge=0)
    vendor: Optional[str] = Field(None, max_length=255)
    reorder_flag: Optional[bool] = None


class InventoryAssignIn(BaseModel):
    user_id: Optional[str] = None


class InventoryMoveIn(BaseModel):
    zone_id: Optional[str] = None


class InventoryUseIn(BaseModel):
    work_request_id: str
    quantity: float = Field(..., gt=0)


class InventorySettingsOut(BaseModel):
    settings: dict[str, Any]


class InventorySettingsPatchIn(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)
