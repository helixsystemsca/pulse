"""Schemas for `/api/workers` (roster, HR, compliance & work summaries)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


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
    is_active: bool
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None


class WorkerListOut(BaseModel):
    items: list[WorkerRowOut]


class WorkerDetailOut(BaseModel):
    id: str
    company_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
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
    compliance_summary: WorkerComplianceSummaryOut
    work_summary: WorkerWorkSummaryOut
    created_at: datetime


class WorkerCreateIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)
    role: str = Field(..., description="manager | worker")
    phone: Optional[str] = Field(None, max_length=64)
    department: Optional[str] = Field(None, max_length=128)
    job_title: Optional[str] = Field(None, max_length=255)
    shift: Optional[str] = Field(None, max_length=64)
    supervisor_id: Optional[str] = None
    start_date: Optional[date] = None
    certifications: Optional[list[WorkerCertificationIn]] = None
    skills: Optional[list[WorkerSkillIn]] = None
    training: Optional[list[WorkerTrainingIn]] = None


class WorkerPatchIn(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    role: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=64)
    department: Optional[str] = Field(None, max_length=128)
    job_title: Optional[str] = Field(None, max_length=255)
    shift: Optional[str] = Field(None, max_length=64)
    supervisor_id: Optional[str] = None
    start_date: Optional[date] = None
    profile_notes: Optional[str] = None
    supervisor_notes: Optional[str] = None
    certifications: Optional[list[WorkerCertificationIn]] = None
    skills: Optional[list[WorkerSkillIn]] = None
    training: Optional[list[WorkerTrainingIn]] = None


class WorkersSettingsOut(BaseModel):
    settings: dict[str, Any]


class WorkersSettingsPatchIn(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)
