"""Pydantic schemas for infrastructure map graph endpoints (`/api/assets`, `/api/connections`, ...)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


SystemType = Literal["fiber", "irrigation", "electrical", "telemetry"]


class InfraAssetBase(BaseModel):
    name: str = Field("", max_length=255)
    type: str = Field("asset", max_length=64)
    system_type: SystemType = "telemetry"
    x: float
    y: float
    notes: Optional[str] = None


class InfraAssetCreateIn(InfraAssetBase):
    project_id: Optional[str] = Field(
        None,
        description="pulse_projects.id — omit for tenant-level facility maps (map has no project)",
    )
    map_id: Optional[str] = Field(None, description="facility_maps.id — scope asset to a facility map")

    @field_validator("project_id")
    @classmethod
    def strip_pid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("map_id")
    @classmethod
    def strip_map(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()


class InfraAssetPatchIn(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    type: Optional[str] = Field(None, max_length=64)
    system_type: Optional[SystemType] = None
    x: Optional[float] = None
    y: Optional[float] = None
    notes: Optional[str] = None


class InfraAssetOut(InfraAssetBase):
    id: str
    project_id: Optional[str] = None
    map_id: Optional[str] = None
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
    project_id: Optional[str] = Field(
        None,
        description="pulse_projects.id — omit when linking assets on a tenant-level facility map",
    )
    map_id: Optional[str] = Field(None, description="facility_maps.id — must match endpoint assets")

    @field_validator("project_id")
    @classmethod
    def strip_cpid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("map_id")
    @classmethod
    def strip_conn_map(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()


class InfraConnectionOut(InfraConnectionBase):
    id: str
    project_id: Optional[str] = None
    map_id: Optional[str] = None
    active: bool
    created_at: datetime


class InfraAttributeBase(BaseModel):
    entity_type: Literal["asset", "connection"]
    entity_id: str
    key: str = Field(..., min_length=1, max_length=80)
    value: str = Field("", max_length=12000)


class InfraAttributeCreateIn(InfraAttributeBase):
    pass


class InfraAttributeUpsertIn(InfraAttributeCreateIn):
    """Upsert body for PATCH /attributes/upsert (same shape as POST /attributes)."""


class InfraAttributeOut(InfraAttributeBase):
    id: str
    created_at: datetime


class TraceRouteIn(BaseModel):
    start_asset_id: str
    end_asset_id: str
    project_id: Optional[str] = Field(
        None,
        description="pulse_projects.id — omit for tenant-level facility maps when map_id is set",
    )
    map_id: Optional[str] = Field(None, description="When set, route only within this facility map graph")
    system_type: Optional[SystemType] = None
    filters: Optional[list[dict[str, Any]]] = None

    @field_validator("project_id")
    @classmethod
    def strip_trace_pid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("map_id")
    @classmethod
    def strip_trace_map(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()


class TraceRouteOut(BaseModel):
    asset_ids: list[str]
    connection_ids: list[str]
    filtered_out_count: int = 0
    reason: Optional[str] = None

