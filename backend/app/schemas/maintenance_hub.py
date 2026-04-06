"""Unified Maintenance hub API (work orders, procedures, preventative rules)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

WorkOrderType = Literal["preventative", "issue", "request"]
WorkOrderStatusApi = Literal["open", "in_progress", "completed", "cancelled"]


class ProcedureOut(BaseModel):
    id: str
    company_id: str
    title: str
    steps: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("steps", mode="before")
    @classmethod
    def _steps(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x) for x in v]
        return []


class ProcedureCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    steps: list[str] = Field(default_factory=list)


class ProcedureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    steps: Optional[list[str]] = None


class WorkOrderOut(BaseModel):
    id: str
    type: WorkOrderType
    title: str
    asset_id: Optional[str] = Field(None, description="equipment_id preferred, else tool_id")
    procedure_id: Optional[str] = None
    status: WorkOrderStatusApi
    due_date: Optional[datetime] = None
    created_at: datetime
    description: Optional[str] = None
    zone_id: Optional[str] = None
    equipment_id: Optional[str] = None
    tool_id: Optional[str] = None


class WorkOrderDetailOut(WorkOrderOut):
    procedure: Optional[ProcedureOut] = None


class WorkOrderCreate(BaseModel):
    type: WorkOrderType = "issue"
    title: str = Field(..., min_length=1, max_length=255)
    asset_id: Optional[str] = None
    procedure_id: Optional[str] = None
    status: WorkOrderStatusApi = "open"
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    zone_id: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    type: Optional[WorkOrderType] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    asset_id: Optional[str] = None
    procedure_id: Optional[str] = None
    status: Optional[WorkOrderStatusApi] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    zone_id: Optional[str] = None


class PreventativeRuleOut(BaseModel):
    id: str
    company_id: str
    asset_id: str
    frequency: str
    procedure_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PreventativeRuleCreate(BaseModel):
    asset_id: str
    frequency: str = Field(..., min_length=1, max_length=128)
    procedure_id: Optional[str] = None


class PreventativeRuleUpdate(BaseModel):
    asset_id: Optional[str] = None
    frequency: Optional[str] = Field(None, min_length=1, max_length=128)
    procedure_id: Optional[str] = None
