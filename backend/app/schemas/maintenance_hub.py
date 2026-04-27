"""Unified Maintenance hub API (work orders, procedures, preventative rules)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

WorkOrderSourceApi = Literal["manual", "auto_pm", "downtime_detected"]

from pydantic import BaseModel, Field, field_validator, model_validator

WorkOrderType = Literal["preventative", "issue", "request"]
WorkOrderStatusApi = Literal["open", "in_progress", "hold", "completed", "cancelled"]


class ProcedureStepOut(BaseModel):
    id: str
    type: Literal["instruction", "checklist", "photo", "warning"]
    content: str
    required: bool = False


def normalize_procedure_steps(v: Any) -> list[ProcedureStepOut]:
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out: list[ProcedureStepOut] = []
    for item in v:
        if not isinstance(item, dict):
            # Ignore bad legacy rows rather than crashing render paths.
            continue
        sid = str(item.get("id") or "").strip()
        stype = str(item.get("type") or "").strip()
        content = str(item.get("content") or "").strip()
        required = bool(item.get("required") or False)
        if not sid or not content:
            continue
        if stype not in ("instruction", "checklist", "photo", "warning"):
            stype = "instruction"
        out.append(ProcedureStepOut(id=sid, type=stype, content=content, required=required))
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
    revised_by_user_id: Optional[str] = None
    revised_by_name: Optional[str] = None
    revised_at: Optional[datetime] = None
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
        for k in ("created_by_user_id", "reviewed_by_user_id", "revised_by_user_id"):
            uid = data.get(k)
            if uid is not None and not isinstance(uid, str):
                data[k] = str(uid)
        return data


class ProcedureStepIn(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    type: Literal["instruction", "checklist", "photo", "warning"] = "instruction"
    content: str = Field(..., min_length=1, max_length=8000)
    required: bool = False


def procedure_steps_to_storage(steps: list[ProcedureStepIn]) -> list[dict[str, Any]]:
    """Serialize API step payloads to JSONB dicts (preserves optional fields)."""
    out: list[dict[str, Any]] = []
    for s in steps:
        d: dict[str, Any] = {
            "id": s.id,
            "type": s.type,
            "content": (s.content or "").strip(),
            "required": bool(s.required),
        }
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
    revised_by_user_id: Optional[str] = None
    revised_by_name: Optional[str] = Field(None, max_length=255)
    revised_at: Optional[datetime] = None


class ProcedureStepImageOut(BaseModel):
    image_url: str


ProcedureAssignmentStatusApi = Literal["pending", "in_progress", "completed"]
ProcedureAssignmentKindApi = Literal["complete", "revise", "create"]


class ProcedureAssignmentCreate(BaseModel):
    procedure_id: str
    assigned_to_user_id: str
    kind: ProcedureAssignmentKindApi = "complete"
    notes: Optional[str] = Field(None, max_length=8000)
    due_at: Optional[datetime] = None


class ProcedureAssignmentOut(BaseModel):
    id: str
    company_id: str
    procedure_id: str
    procedure_title: str
    assigned_to_user_id: str
    assigned_by_user_id: Optional[str] = None
    kind: ProcedureAssignmentKindApi = "complete"
    status: ProcedureAssignmentStatusApi
    notes: Optional[str] = None
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProcedureAssignmentPhotoOut(BaseModel):
    id: str
    url: str
    created_at: datetime


class ProcedureAssignmentDetailOut(ProcedureAssignmentOut):
    procedure: ProcedureOut
    photos: list[ProcedureAssignmentPhotoOut] = Field(default_factory=list)


class ProcedureAssignmentCompleteOut(BaseModel):
    ok: bool = True
    assignment_id: str
    completed_at: datetime


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
