"""Unified Maintenance hub API (work orders, procedures, preventative rules)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

WorkOrderSourceApi = Literal["manual", "auto_pm", "downtime_detected"]

import re
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator

WorkOrderType = Literal["preventative", "issue", "request"]
WorkOrderStatusApi = Literal["open", "in_progress", "hold", "completed", "cancelled"]


class ProcedureStepOut(BaseModel):
    id: str
    type: Literal["instruction", "checklist", "photo", "warning"]
    content: str
    required: bool = False
    image_url: Optional[str] = None
    recommended_workers: Optional[int] = None
    tools: list[str] = Field(default_factory=list)


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
    """Load steps from JSONB; supports canonical `{id,type,content}` and legacy UI `{text, image_url, tools}`."""
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out: list[ProcedureStepOut] = []
    for i, item in enumerate(v):
        if isinstance(item, str):
            body = item.strip()
            if not body:
                continue
            out.append(
                ProcedureStepOut(
                    id=f"s{i + 1}-{uuid4().hex[:8]}",
                    type="instruction",
                    content=body,
                    required=False,
                )
            )
            continue
        if not isinstance(item, dict):
            continue
        sid = str(item.get("id") or "").strip() or f"s{i + 1}-{uuid4().hex[:8]}"
        stype = str(item.get("type") or "").strip()
        content = str(item.get("content") or "").strip()
        if not content:
            content = str(item.get("text") or "").strip()
        img_raw = item.get("image_url")
        image_url = str(img_raw).strip() if img_raw is not None and str(img_raw).strip() else None
        if not content and image_url:
            content = "See step image."
            if stype not in ("instruction", "checklist", "photo", "warning"):
                stype = "photo"
        if not content:
            continue
        if stype not in ("instruction", "checklist", "photo", "warning"):
            stype = "instruction"
        required = bool(item.get("required") or False)
        rw_raw = item.get("recommended_workers")
        recommended_workers: Optional[int] = None
        if rw_raw is not None and rw_raw != "":
            try:
                recommended_workers = int(rw_raw)
            except (TypeError, ValueError):
                recommended_workers = None
        tools: list[str] = []
        tr = item.get("tools")
        if isinstance(tr, list):
            tools = [str(x).strip() for x in tr if str(x).strip()][:48]
        elif isinstance(tr, str) and tr.strip():
            tools = [p.strip() for p in tr.split(",") if p.strip()][:48]
        out.append(
            ProcedureStepOut(
                id=sid,
                type=stype,
                content=content,
                required=required,
                image_url=image_url,
                recommended_workers=recommended_workers,
                tools=tools,
            )
        )
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
    content_revision: int = 1
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
    model_config = {"extra": "ignore"}

    id: str = Field(..., min_length=1, max_length=64)
    type: Literal["instruction", "checklist", "photo", "warning"] = "instruction"
    content: str = Field(..., min_length=1, max_length=8000)
    required: bool = False
    image_url: Optional[str] = Field(None, max_length=2000)
    recommended_workers: Optional[int] = Field(None, ge=0, le=999)
    tools: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_ui_step_payload(cls, data: Any) -> Any:
        """Accept `{text, image_url, tools}` from the Procedures UI as well as canonical `{id, type, content}`."""
        if not isinstance(data, dict):
            return data
        d = dict(data)
        tid = str(d.get("id") or "").strip()
        if not tid:
            d["id"] = uuid4().hex[:12]
        content = str(d.get("content") or "").strip()
        text = str(d.get("text") or "").strip()
        if not content and text:
            d["content"] = text
        elif not content and str(d.get("image_url") or "").strip():
            d["content"] = "See step image."
            if str(d.get("type") or "").strip() not in ("instruction", "checklist", "photo", "warning"):
                d["type"] = "photo"
        tr = d.get("tools")
        if tr is not None and not isinstance(tr, list):
            if isinstance(tr, str):
                d["tools"] = [x.strip() for x in tr.split(",") if x.strip()]
            else:
                d["tools"] = []
        rw = d.get("recommended_workers")
        if rw is not None and rw != "":
            try:
                d["recommended_workers"] = int(rw)
            except (TypeError, ValueError):
                d["recommended_workers"] = None
        else:
            d.pop("recommended_workers", None)
        return d


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
        if s.image_url:
            d["image_url"] = str(s.image_url).strip()
        if s.recommended_workers is not None:
            d["recommended_workers"] = s.recommended_workers
        if s.tools:
            d["tools"] = list(s.tools)
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
