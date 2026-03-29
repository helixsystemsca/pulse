"""Pydantic schemas for Pulse REST API."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.pulse_models import PulseWorkRequestStatus


class DashboardOut(BaseModel):
    active_workers: int
    open_work_requests: int
    low_stock_items: int
    shifts_today: int
    alerts: list[str]


class WorkRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    tool_id: Optional[str] = None
    zone_id: Optional[str] = None
    priority: int = 0
    assigned_user_id: Optional[str] = None


class WorkRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    tool_id: Optional[str] = None
    zone_id: Optional[str] = None
    priority: Optional[int] = None
    status: Optional[PulseWorkRequestStatus] = None
    assigned_user_id: Optional[str] = None


class WorkRequestOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str]
    tool_id: Optional[str]
    zone_id: Optional[str]
    priority: int
    status: str
    assigned_user_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkRequestListOut(BaseModel):
    items: list[WorkRequestOut]
    total: int


class WorkerOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    certifications: list[str]
    notes: Optional[str]
    availability: dict[str, Any]


class WorkerProfilePatch(BaseModel):
    certifications: Optional[list[str]] = None
    notes: Optional[str] = None
    availability: Optional[dict[str, Any]] = None


class ShiftCreate(BaseModel):
    assigned_user_id: str
    starts_at: datetime
    ends_at: datetime
    zone_id: Optional[str] = None
    shift_type: str = "shift"
    requires_supervisor: bool = False
    requires_ticketed: bool = False


class ShiftUpdate(BaseModel):
    assigned_user_id: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    zone_id: Optional[str] = None
    shift_type: Optional[str] = None
    requires_supervisor: Optional[bool] = None
    requires_ticketed: Optional[bool] = None


class ShiftOut(BaseModel):
    id: str
    company_id: str
    assigned_user_id: str
    zone_id: Optional[str]
    starts_at: datetime
    ends_at: datetime
    shift_type: str
    requires_supervisor: bool
    requires_ticketed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ShiftCreateResult(BaseModel):
    shift: ShiftOut
    warnings: list[str]


class ZoneOut(BaseModel):
    id: str
    name: str
    meta: dict[str, Any]

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: str
    tag_id: str
    name: str
    zone_id: Optional[str]
    status: str
    assigned_user_id: Optional[str]

    model_config = {"from_attributes": True}


class AssetPatch(BaseModel):
    status: Optional[str] = None


class InventoryItemOut(BaseModel):
    id: str
    sku: str
    name: str
    quantity: float
    unit: str
    low_stock_threshold: float

    model_config = {"from_attributes": True}


class InventoryPatch(BaseModel):
    quantity: Optional[float] = None
    low_stock_threshold: Optional[float] = None


class BeaconEquipmentCreate(BaseModel):
    beacon_id: str = Field(..., min_length=1, max_length=128)
    tool_id: Optional[str] = None
    location_label: str = ""


class BeaconEquipmentPatch(BaseModel):
    tool_id: Optional[str] = None
    location_label: Optional[str] = None
    is_active: Optional[bool] = None


class BeaconEquipmentOut(BaseModel):
    id: str
    beacon_id: str
    tool_id: Optional[str]
    location_label: str
    photo_path: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoUploadOut(BaseModel):
    photo_path: str
    storage: str = "local"
