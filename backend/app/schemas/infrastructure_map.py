"""Pydantic schemas for infrastructure map graph endpoints (`/api/assets`, `/api/connections`, ...)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


SystemType = Literal["fiber", "irrigation", "electrical", "telemetry"]


class InfraAssetBase(BaseModel):
    name: str = Field("", max_length=255)
    type: str = Field("asset", max_length=64)
    system_type: SystemType = "telemetry"
    x: float
    y: float
    notes: Optional[str] = None


class InfraAssetCreateIn(InfraAssetBase):
    pass


class InfraAssetPatchIn(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    type: Optional[str] = Field(None, max_length=64)
    system_type: Optional[SystemType] = None
    x: Optional[float] = None
    y: Optional[float] = None
    notes: Optional[str] = None


class InfraAssetOut(InfraAssetBase):
    id: str
    created_at: datetime
    updated_at: datetime


class InfraConnectionBase(BaseModel):
    from_asset_id: str
    to_asset_id: str
    system_type: SystemType = "telemetry"
    connection_type: str = Field("link", max_length=32)

    @model_validator(mode="after")
    def endpoints(self) -> "InfraConnectionBase":
        if str(self.from_asset_id).strip() == str(self.to_asset_id).strip():
            raise ValueError("from_asset_id and to_asset_id must differ")
        return self


class InfraConnectionCreateIn(InfraConnectionBase):
    pass


class InfraConnectionOut(InfraConnectionBase):
    id: str
    active: bool
    created_at: datetime


class InfraAttributeBase(BaseModel):
    entity_type: Literal["asset", "connection"]
    entity_id: str
    key: str = Field(..., min_length=1, max_length=80)
    value: str = Field("", max_length=12000)


class InfraAttributeCreateIn(InfraAttributeBase):
    pass


class InfraAttributeOut(InfraAttributeBase):
    id: str
    created_at: datetime


class TraceRouteIn(BaseModel):
    start_asset_id: str
    end_asset_id: str
    system_type: Optional[SystemType] = None


class TraceRouteOut(BaseModel):
    asset_ids: list[str]
    connection_ids: list[str]

