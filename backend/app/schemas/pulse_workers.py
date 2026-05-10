"""Schemas for `/api/workers` (roster, HR, compliance & work summaries)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMPLOYMENT_TYPES = {"full_time", "regular_part_time", "part_time"}


class WorkerCertificationIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    expiry_date: Optional[datetime] = None


class WorkerSkillIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    level: int = Field(1, ge=1, le=5)


class WorkerTrainingIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    completed_at: datetime


class WorkerCertificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    expiry_date: Optional[datetime] = None
    status: str  # valid | expired | no_expiry


class WorkerSkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    level: int


class WorkerTrainingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    completed_at: datetime


class WorkerComplianceSummaryOut(BaseModel):
    compliance_rate_pct: float
    missed_acknowledgments: int
    repeat_offender: bool
    flagged_count: int


class WorkerWorkSummaryOut(BaseModel):
    open_work_requests: int
    completed_tasks: int
    avg_completion_hours: Optional[float] = None


class WorkerRowOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    roles: list[str] = []
    is_active: bool
    account_status: str = "active"
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    shift: Optional[str] = None
    #: From pulse worker profile scheduling (`full_time` | `regular_part_time` | `part_time`).
    employment_type: Optional[str] = None
    avatar_url: Optional[str] = None
    last_active_at: Optional[datetime] = None
    last_login_city: Optional[str] = None
    last_login_region: Optional[str] = None
    last_login_user_agent: Optional[str] = None


class WorkerListOut(BaseModel):
    items: list[WorkerRowOut]


class WorkerDetailOut(BaseModel):
    id: str
    company_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    roles: list[str] = []
    avatar_url: Optional[str] = None
    #: Add-on product modules (tenant contract subset) from company admin.
    feature_allow_extra: list[str] = []
    is_active: bool
    account_status: str = "active"
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    shift: Optional[str] = None
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    start_date: Optional[date] = None
    certifications: list[WorkerCertificationOut]
    skills: list[WorkerSkillOut]
    training: list[WorkerTrainingOut]
    legacy_certifications: list[str] = []
    availability: dict[str, Any] = {}
    profile_notes: Optional[str] = None
    supervisor_notes: Optional[str] = None
    #: From `pulse_worker_profiles.scheduling` — same values exposed on Pulse schedule workers.
    employment_type: Optional[str] = None
    #: Weekly rotation templates for Pulse schedule (`pulse_worker_profiles.scheduling`).
    recurring_shifts: list[dict[str, Any]] = Field(default_factory=list)
    compliance_summary: WorkerComplianceSummaryOut
    work_summary: WorkerWorkSummaryOut
    created_at: datetime


class WorkerCreateIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    full_name: Optional[str] = Field(None, max_length=255)
    role: str = Field(..., description="worker | lead | supervisor | manager")
    phone: Optional[str] = Field(None, max_length=64)
    department: Optional[str] = Field(None, max_length=128)
    job_title: Optional[str] = Field(None, max_length=255)
    shift: Optional[str] = Field(None, max_length=64)
    supervisor_id: Optional[str] = None
    start_date: Optional[date] = None
    employment_type: Optional[str] = None
    certifications: Optional[list[WorkerCertificationIn]] = None
    skills: Optional[list[WorkerSkillIn]] = None
    training: Optional[list[WorkerTrainingIn]] = None
    #: When false, a join token is still issued but no invite email is sent (share link manually).
    send_email: bool = True
    #: Company / tenant admins only: add roster + HR as an **active** account (no invite; use invite/link flows for pending activation).
    roster_profile_only: bool = False

    @field_validator("supervisor_id", mode="before")
    @classmethod
    def _normalize_supervisor_id(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return str(v).strip() or None

    @field_validator("employment_type", mode="before")
    @classmethod
    def _normalize_employment_type(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if s not in _EMPLOYMENT_TYPES:
            raise ValueError("Invalid employment_type")
        return s


class WorkerPatchIn(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=320)
    is_active: Optional[bool] = None
    role: Optional[str] = None
    roles: Optional[list[str]] = None
    phone: Optional[str] = Field(None, max_length=64)
    department: Optional[str] = Field(None, max_length=128)
    job_title: Optional[str] = Field(None, max_length=255)
    shift: Optional[str] = Field(None, max_length=64)
    supervisor_id: Optional[str] = None
    start_date: Optional[date] = None
    profile_notes: Optional[str] = None
    supervisor_notes: Optional[str] = None
    employment_type: Optional[str] = None
    recurring_shifts: Optional[list[dict[str, Any]]] = None
    certifications: Optional[list[WorkerCertificationIn]] = None
    skills: Optional[list[WorkerSkillIn]] = None
    training: Optional[list[WorkerTrainingIn]] = None
    feature_allow_extra: Optional[list[str]] = None

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email_patch(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip().lower()
            return s or None
        return str(v).strip().lower() or None

    @field_validator("supervisor_id", mode="before")
    @classmethod
    def _normalize_supervisor_id_patch(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return str(v).strip() or None

    @field_validator("employment_type", mode="before")
    @classmethod
    def _normalize_employment_type_patch(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if s not in _EMPLOYMENT_TYPES:
            raise ValueError("Invalid employment_type")
        return s


class WorkersSettingsOut(BaseModel):
    settings: dict[str, Any]
    #: Tenant contract module keys for this company (for Workers UI when session has no `contract_enabled_features`).
    contract_feature_names: list[str] = []


class WorkersSettingsPatchIn(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)


class WorkerCreateResultOut(BaseModel):
    worker: WorkerDetailOut
    invite_link_path: str
    invite_email_sent: Optional[bool] = None
    message: str = "Invite sent"


class WorkerResendInviteIn(BaseModel):
    """When `send_email` is false, a fresh join token is issued but no invite email is sent (manual share)."""

    send_email: bool = True
