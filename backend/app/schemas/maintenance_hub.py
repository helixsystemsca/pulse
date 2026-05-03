"""Unified Maintenance hub API (work orders, procedures, preventative rules)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

WorkOrderSourceApi = Literal["manual", "auto_pm", "downtime_detected"]

import re

from pydantic import BaseModel, Field, field_validator, model_validator

WorkOrderType = Literal["preventative", "issue", "request"]
WorkOrderStatusApi = Literal["open", "in_progress", "hold", "completed", "cancelled"]


class ProcedureStepOut(BaseModel):
    id: str
    type: Literal["instruction", "checklist", "photo", "warning"]
    content: str
    required: bool = False


def normalize_procedure_search_keywords(v: Any) -> list[str]:
    """Dedupe, trim, cap count/length for internal procedure lookup labels."""
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in v:
        s = str(x).strip()[:64]
        if not s:
            continue
        low = s.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(s)
        if len(out) >= 32:
            break
    return out


def parse_procedure_keyword_filter(raw: Optional[str]) -> list[str]:
    """Split comma/semicolon/newline separated filter; lowercase tokens."""
    if not raw or not str(raw).strip():
        return []
    parts = re.split(r"[,;\n]+", str(raw).strip())
    return [p.strip().lower() for p in parts if p.strip()][:24]


def procedure_row_matches_keyword_tokens(stored: Any, tokens: list[str]) -> bool:
    """True if any stored keyword contains any token (case-insensitive substring)."""
    if not tokens:
        return True
    kws: list[str] = []
    if isinstance(stored, list):
        kws = [str(x).strip().lower() for x in stored if str(x).strip()]
    for tok in tokens:
        if not tok:
            continue
        if any(tok in kw for kw in kws):
            return True
    return False


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
    search_keywords: list[str] = Field(default_factory=list, description="Internal labels for admin filtering only")
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

    @field_validator("search_keywords", mode="before")
    @classmethod
    def _search_keywords(cls, v: Any) -> list[str]:
        return normalize_procedure_search_keywords(v)

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
    search_keywords: list[str] = Field(default_factory=list)
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = Field(None, max_length=255)
    review_required: bool = False

    @field_validator("search_keywords", mode="before")
    @classmethod
    def _create_kw(cls, v: Any) -> list[str]:
        return normalize_procedure_search_keywords(v)


class ProcedureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    steps: Optional[list[ProcedureStepIn]] = None
    search_keywords: Optional[list[str]] = None
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = Field(None, max_length=255)
    review_required: Optional[bool] = None
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_name: Optional[str] = Field(None, max_length=255)
    reviewed_at: Optional[datetime] = None
    revised_by_user_id: Optional[str] = None
    revised_by_name: Optional[str] = Field(None, max_length=255)
    revised_at: Optional[datetime] = None

    @field_validator("search_keywords", mode="before")
    @classmethod
    def _update_kw(cls, v: Any) -> Optional[list[str]]:
        if v is None:
            return None
        return normalize_procedure_search_keywords(v)


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
