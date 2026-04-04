"""Request/response models for gateways, BLE tags, equipment, zones (UI-friendly)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# --- Gateways ---


class GatewayCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    identifier: str = Field(..., min_length=1, max_length=128)
    zone_id: Optional[str] = None


class GatewayPatchIn(BaseModel):
    zone_id: Optional[str] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[str] = Field(None, max_length=32)


class GatewayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    identifier: str
    status: str
    zone_id: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    ingest_enabled: bool = False


class GatewayIngestSecretRotateOut(BaseModel):
    """Returned once when rotating; store only on the gateway device (ESP32), never re-displayed."""

    gateway_id: str
    ingest_secret: str


# --- BLE ---


class BleDeviceCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    mac_address: str = Field(..., min_length=8, max_length=32)
    type: Literal["worker_tag", "equipment_tag"]
    assigned_worker_id: Optional[str] = None
    assigned_equipment_id: Optional[str] = None


class BleDeviceAssignIn(BaseModel):
    assigned_worker_id: Optional[str] = None
    assigned_equipment_id: Optional[str] = None


class BleDeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    mac_address: str
    type: str
    assigned_worker_id: Optional[str] = None
    assigned_equipment_id: Optional[str] = None
    last_seen_at: Optional[datetime] = None


# --- Equipment (Tool) ---


class EquipmentCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: Optional[str] = Field(None, max_length=128, description="Stored in display name for now")
    tag_id: Optional[str] = Field(None, max_length=128)
    zone_id: Optional[str] = None
    status: Optional[str] = Field("available", description="ToolStatus value")
    link_ble_device_id: Optional[str] = Field(None, description="Assign this equipment tag to the new tool")


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    tag_id: str
    zone_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    status: str


class EquipmentLinkBleIn(BaseModel):
    ble_device_id: str


# --- Zones ---


class ZoneCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


class ZoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    name: str
    description: Optional[str] = None
    meta: dict[str, Any] = Field(default_factory=dict)
