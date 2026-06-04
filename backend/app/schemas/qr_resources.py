"""QR resource management schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class QrResourceOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    resource_type: str
    resource_id: str
    qr_token: str
    qr_url: str
    guest_access_enabled: bool
    guest_access_level: str
    linked_resource_label: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class QrResourceListOut(BaseModel):
    items: list[QrResourceOut]


class QrResourceCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    resource_type: str = Field(..., min_length=1, max_length=64)
    resource_id: str = Field(..., min_length=1, max_length=64)
    guest_access_enabled: bool = False
    guest_access_level: str = "none"


class QrResourcePatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    resource_type: Optional[str] = Field(None, min_length=1, max_length=64)
    resource_id: Optional[str] = Field(None, min_length=1, max_length=64)
    guest_access_enabled: Optional[bool] = None
    guest_access_level: Optional[str] = None


class QrResourceOptionOut(BaseModel):
    id: str
    label: str
    subtitle: Optional[str] = None


class QrResourceOptionsOut(BaseModel):
    resource_type: str
    items: list[QrResourceOptionOut]


class QrResolveOut(BaseModel):
    qr_token: str
    name: str
    description: Optional[str] = None
    resource_type: str
    resource_id: str
    destination_path: str
    guest_destination_path: Optional[str] = None
    guest_access_enabled: bool
    guest_access_level: str
    requires_auth: bool
    guest_payload: Optional[dict[str, Any]] = None
