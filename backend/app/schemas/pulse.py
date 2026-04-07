"""Pydantic schemas for Pulse REST API."""

from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, Field, field_validator

from app.models.pulse_models import PulseWorkOrderType, PulseWorkRequestPriority, PulseWorkRequestStatus
from app.modules.work_requests.helpers import priority_from_legacy_int


class DashboardOut(BaseModel):
    active_workers: int
    open_work_requests: int
    low_stock_items: int
    shifts_today: int
    alerts: list[str]


class WorkRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    work_order_type: Union[str, PulseWorkOrderType] = PulseWorkOrderType.issue
    procedure_id: Optional[str] = None
    tool_id: Optional[str] = None
    equipment_id: Optional[str] = None
    part_id: Optional[str] = None
    zone_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=128)
    priority: Union[int, str, PulseWorkRequestPriority] = PulseWorkRequestPriority.medium
    assigned_user_id: Optional[str] = None
    due_date: Optional[datetime] = None
    attachments: Optional[list[Any]] = None

    @field_validator("work_order_type", mode="before")
    @classmethod
    def _wot_coerce(cls, v: Any) -> PulseWorkOrderType:
        if v is None:
            return PulseWorkOrderType.issue
        if isinstance(v, PulseWorkOrderType):
            return v
        return PulseWorkOrderType(str(v))

    @field_validator("priority", mode="before")
    @classmethod
    def _priority_coerce(cls, v: Any) -> PulseWorkRequestPriority:
        if v is None:
            return PulseWorkRequestPriority.medium
        if isinstance(v, PulseWorkRequestPriority):
            return v
        if isinstance(v, int):
            return priority_from_legacy_int(v)
        return PulseWorkRequestPriority(str(v))


class WorkRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    work_order_type: Optional[Union[str, PulseWorkOrderType]] = None
    procedure_id: Optional[str] = None
    tool_id: Optional[str] = None
    equipment_id: Optional[str] = None
    part_id: Optional[str] = None
    zone_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=128)
    priority: Optional[Union[int, str, PulseWorkRequestPriority]] = None
    status: Optional[PulseWorkRequestStatus] = None
    assigned_user_id: Optional[str] = None
    due_date: Optional[datetime] = None
    attachments: Optional[list[Any]] = None

    @field_validator("work_order_type", mode="before")
    @classmethod
    def _wot_coerce_upd(cls, v: Any) -> Optional[PulseWorkOrderType]:
        if v is None:
            return None
        if isinstance(v, PulseWorkOrderType):
            return v
        return PulseWorkOrderType(str(v))

    @field_validator("priority", mode="before")
    @classmethod
    def _priority_coerce_upd(cls, v: Any) -> Optional[PulseWorkRequestPriority]:
        if v is None:
            return None
        if isinstance(v, PulseWorkRequestPriority):
            return v
        if isinstance(v, int):
            return priority_from_legacy_int(v)
        return PulseWorkRequestPriority(str(v))


class WorkRequestOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str]
    tool_id: Optional[str]
    equipment_id: Optional[str] = None
    part_id: Optional[str] = None
    zone_id: Optional[str]
    category: Optional[str]
    work_order_type: str = "issue"
    procedure_id: Optional[str] = None
    priority: str
    status: str
    assigned_user_id: Optional[str]
    created_by_user_id: Optional[str] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    attachments: list[Any] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("priority", "status", "work_order_type", mode="before")
    @classmethod
    def _coerce_enum_str(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)

    @field_validator("attachments", mode="before")
    @classmethod
    def _attachments_default(cls, v: Any) -> list[Any]:
        return [] if v is None else list(v)


class WorkRequestListOut(BaseModel):
    items: list[WorkRequestOut]
    total: int


class WorkerSkillMiniOut(BaseModel):
    name: str
    level: int = 1


class WorkerOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    roles: list[str] = []
    certifications: list[str]
    skills: list[WorkerSkillMiniOut] = []
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
    shift_kind: str = "workforce"
    display_label: Optional[str] = None
    project_task_id: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    task_priority: Optional[str] = None

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
    usage_count: int = 0
    item_type: str = "part"
    category: Optional[str] = None
    inv_status: str = "in_stock"
    zone_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    linked_tool_id: Optional[str] = None
    item_condition: str = "good"
    reorder_flag: bool = False
    unit_cost: Optional[float] = None
    last_movement_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InventoryPatch(BaseModel):
    quantity: Optional[float] = None
    low_stock_threshold: Optional[float] = None
    item_type: Optional[str] = None
    category: Optional[str] = None
    inv_status: Optional[str] = None
    zone_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    linked_tool_id: Optional[str] = None
    item_condition: Optional[str] = None
    reorder_flag: Optional[bool] = None
    unit_cost: Optional[float] = None


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
