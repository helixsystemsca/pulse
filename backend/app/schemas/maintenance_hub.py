"""Unified Maintenance hub API (work orders, procedures, preventative rules)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

WorkOrderSourceApi = Literal["manual", "auto_pm", "downtime_detected"]

from pydantic import BaseModel, Field, field_validator, model_validator

WorkOrderType = Literal["preventative", "issue", "request"]
WorkOrderStatusApi = Literal["open", "in_progress", "hold", "completed", "cancelled"]


class ProcedureStepOut(BaseModel):
    text: str
    image_url: Optional[str] = None
    recommended_workers: Optional[int] = None
    tools: Optional[list[str]] = None


def normalize_procedure_steps(v: Any) -> list[ProcedureStepOut]:
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out: list[ProcedureStepOut] = []
    for item in v:
        if isinstance(item, str):
            out.append(ProcedureStepOut(text=item.strip(), image_url=None))
        elif isinstance(item, dict):
            t = str(item.get("text") or "").strip()
            img = item.get("image_url")
            url = str(img).strip() if img else None
            rw = item.get("recommended_workers")
            rw_int: Optional[int] = None
            if rw is not None and str(rw).strip() != "":
                try:
                    rw_int = max(1, int(rw))
                except (TypeError, ValueError):
                    rw_int = None
            raw_tools = item.get("tools")
            tools_list: Optional[list[str]] = None
            if isinstance(raw_tools, list):
                tools_list = [str(x).strip() for x in raw_tools if str(x).strip()]
            elif isinstance(raw_tools, str) and raw_tools.strip():
                tools_list = [x.strip() for x in raw_tools.split(",") if x.strip()]
            out.append(
                ProcedureStepOut(
                    text=t,
                    image_url=url or None,
                    recommended_workers=rw_int,
                    tools=tools_list,
                )
            )
        else:
            out.append(ProcedureStepOut(text=str(item).strip(), image_url=None))
    return out


class ProcedureOut(BaseModel):
    id: str
    company_id: str
    title: str
    steps: list[ProcedureStepOut]
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = None
    review_required: bool = False
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("steps", mode="before")
    @classmethod
    def _steps(cls, v: Any) -> list[ProcedureStepOut]:
        return normalize_procedure_steps(v)

    @model_validator(mode="before")
    @classmethod
    def _coerce_uuids(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        for k in ("created_by_user_id", "reviewed_by_user_id"):
            uid = data.get(k)
            if uid is not None and not isinstance(uid, str):
                data[k] = str(uid)
        return data


class ProcedureStepIn(BaseModel):
    text: str = Field(default="", max_length=8000)
    image_url: Optional[str] = Field(None, max_length=2048)
    recommended_workers: Optional[int] = Field(None, ge=1)
    tools: Optional[list[str]] = None


def procedure_steps_to_storage(steps: list[ProcedureStepIn]) -> list[dict[str, Any]]:
    """Serialize API step payloads to JSONB dicts (preserves optional fields)."""
    out: list[dict[str, Any]] = []
    for s in steps:
        img = (s.image_url or "").strip() or None
        d: dict[str, Any] = {"text": (s.text or "").strip(), "image_url": img}
        if s.recommended_workers is not None:
            d["recommended_workers"] = s.recommended_workers
        if s.tools:
            d["tools"] = list(s.tools)
        out.append(d)
    return out


class ProcedureCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    steps: list[ProcedureStepIn] = Field(default_factory=list)
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = Field(None, max_length=255)
    review_required: bool = False


class ProcedureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    steps: Optional[list[ProcedureStepIn]] = None
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = Field(None, max_length=255)
    review_required: Optional[bool] = None
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_name: Optional[str] = Field(None, max_length=255)
    reviewed_at: Optional[datetime] = None


class ProcedureStepImageOut(BaseModel):
    image_url: str


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
    pm_task_id: Optional[str] = None
    source: WorkOrderSourceApi = "manual"


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
