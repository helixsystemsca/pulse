"""Schemas for `/api/inventory` (Pulse advanced inventory)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class InventoryTopUsedOut(BaseModel):
    id: str
    name: str
    sku: str
    usage_count: int


class InventorySummaryOut(BaseModel):
    total_items: int
    in_stock: int
    low_stock: int
    assigned: int
    missing: int
    maintenance: int
    estimated_value: Optional[float] = None
    most_used: list[InventoryTopUsedOut] = Field(default_factory=list)


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


class InventoryScopeRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    is_shared: bool = False
    description: Optional[str] = None


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
    department_slug: str = "maintenance"
    scope_id: str
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
    scope_id: Optional[str] = Field(default=None, description="Target inventory scope (admin / multi-pool)")
    department_slug: str = Field(
        "maintenance",
        max_length=64,
        description="Default scope is derived from this slug when scope_id is omitted.",
    )
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
    department_slug: Optional[str] = Field(None, max_length=64)
    scope_id: Optional[str] = Field(default=None, description="Move item to another inventory scope")
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


class InventoryVendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    account_number: Optional[str] = None
    payment_terms: Optional[str] = None
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InventoryVendorCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=64)
    account_number: Optional[str] = Field(None, max_length=128)
    payment_terms: Optional[str] = Field(None, max_length=255)
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = Field(None, max_length=512)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=128)
    region: Optional[str] = Field(None, max_length=128)
    postal_code: Optional[str] = Field(None, max_length=32)
    country: Optional[str] = Field(None, max_length=128)
    is_active: bool = True


class InventoryVendorPatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=64)
    account_number: Optional[str] = Field(None, max_length=128)
    payment_terms: Optional[str] = Field(None, max_length=255)
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = Field(None, max_length=512)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=128)
    region: Optional[str] = Field(None, max_length=128)
    postal_code: Optional[str] = Field(None, max_length=32)
    country: Optional[str] = Field(None, max_length=128)
    is_active: Optional[bool] = None


class InventoryContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    account_number: Optional[str] = None
    payment_terms: Optional[str] = None
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InventoryContractorCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=64)
    account_number: Optional[str] = Field(None, max_length=128)
    payment_terms: Optional[str] = Field(None, max_length=255)
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = Field(None, max_length=512)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=128)
    region: Optional[str] = Field(None, max_length=128)
    postal_code: Optional[str] = Field(None, max_length=32)
    country: Optional[str] = Field(None, max_length=128)
    is_active: bool = True


class InventoryContractorPatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=64)
    account_number: Optional[str] = Field(None, max_length=128)
    payment_terms: Optional[str] = Field(None, max_length=255)
    item_specialty: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = Field(None, max_length=512)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=128)
    region: Optional[str] = Field(None, max_length=128)
    postal_code: Optional[str] = Field(None, max_length=32)
    country: Optional[str] = Field(None, max_length=128)
    is_active: Optional[bool] = None
