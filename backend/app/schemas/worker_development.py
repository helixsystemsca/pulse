"""Schemas for `/api/workers/development` — team performance matrix & employee development."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

DevelopmentQuadrant = Literal["A", "B", "C", "D"]
DevelopmentStatus = Literal["on_track", "developing", "needs_support", "action_required"]


class DevelopmentAssessmentIn(BaseModel):
    strengths: Optional[str] = None
    development_areas: Optional[str] = None
    leadership_potential: Optional[int] = Field(None, ge=1, le=5)
    engagement: Optional[int] = Field(None, ge=1, le=5)
    reliability: Optional[int] = Field(None, ge=1, le=5)
    communication: Optional[int] = Field(None, ge=1, le=5)
    initiative: Optional[int] = Field(None, ge=1, le=5)
    technical_skills: Optional[int] = Field(None, ge=1, le=5)
    overall_summary: Optional[str] = None


class DevelopmentAssessmentOut(DevelopmentAssessmentIn):
    model_config = ConfigDict(from_attributes=True)


class DevelopmentPlanMilestonesOut(BaseModel):
    days_30: list[str] = Field(default_factory=list, alias="30")
    days_60: list[str] = Field(default_factory=list, alias="60")
    days_90: list[str] = Field(default_factory=list, alias="90")

    model_config = ConfigDict(populate_by_name=True)


class DevelopmentPlanOut(BaseModel):
    objective: Optional[str] = None
    quadrant: Optional[DevelopmentQuadrant] = None
    generated_at: Optional[datetime] = None
    milestones: dict[str, list[str]] = Field(default_factory=dict)
    custom_notes: Optional[str] = None


class DevelopmentTimelineItemOut(BaseModel):
    id: str
    kind: str
    title: str
    scheduled_date: Optional[date] = None
    status: str = "pending"
    notes: Optional[str] = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class DevelopmentHistoryItemOut(BaseModel):
    id: str
    at: datetime
    kind: str
    summary: str
    detail: Optional[str] = None


class EmployeeCareerProfileOut(BaseModel):
    desired_position: Optional[str] = None
    leadership_interest: Optional[str] = None
    promotion_readiness: Optional[str] = None
    mentor_user_id: Optional[str] = None
    mentor_name: Optional[str] = None
    career_notes: Optional[str] = None


class EmployeeCareerProfileIn(EmployeeCareerProfileOut):
    pass


RECOGNITION_CATEGORIES = Literal[
    "customer_service",
    "innovation",
    "leadership",
    "safety",
    "teamwork",
    "other",
]


class EmployeeRecognitionOut(BaseModel):
    id: str
    at: datetime
    title: str
    description: Optional[str] = None
    awarded_by: Optional[str] = None
    awarded_by_user_id: Optional[str] = None
    category: str = "other"


class EmployeeRecognitionIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = "other"
    awarded_by: Optional[str] = None


class UnifiedHistoryItemOut(BaseModel):
    id: str
    at: datetime
    kind: str
    summary: str
    detail: Optional[str] = None
    source: str = "development"


class RecognitionFeedItemOut(BaseModel):
    id: str
    user_id: str
    employee_name: str
    at: datetime
    title: str
    description: Optional[str] = None
    category: str
    awarded_by: Optional[str] = None


class RecognitionFeedOut(BaseModel):
    items: list[RecognitionFeedItemOut] = Field(default_factory=list)


class WorkerDevelopmentSummaryOut(BaseModel):
    """Roster row + development fields for matrix and cards."""

    user_id: str
    full_name: Optional[str] = None
    email: str
    job_title: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    start_date: Optional[date] = None
    is_active: bool = True
    development_quadrant: DevelopmentQuadrant = "C"
    development_status: DevelopmentStatus = "developing"
    last_assessment_at: Optional[datetime] = None
    next_review_date: Optional[date] = None
    assessment_summary: Optional[str] = None
    performance_score: Optional[float] = None
    potential_score: Optional[float] = None
    roster_skills: list[str] = Field(default_factory=list)


class WorkerDevelopmentListOut(BaseModel):
    items: list[WorkerDevelopmentSummaryOut]
    last_updated_at: Optional[datetime] = None


class WorkerDevelopmentDetailOut(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    email: str
    job_title: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    start_date: Optional[date] = None
    development_quadrant: DevelopmentQuadrant = "C"
    development_status: DevelopmentStatus = "developing"
    last_assessment_at: Optional[datetime] = None
    next_review_date: Optional[date] = None
    manager_notes: Optional[str] = None
    career_goals: Optional[str] = None
    assessment: DevelopmentAssessmentOut
    development_plan: DevelopmentPlanOut
    skills: list[str] = Field(default_factory=list)
    roster_skills: list[str] = Field(default_factory=list)
    timeline: list[DevelopmentTimelineItemOut] = Field(default_factory=list)
    history: list[DevelopmentHistoryItemOut] = Field(default_factory=list)
    career: EmployeeCareerProfileOut = Field(default_factory=EmployeeCareerProfileOut)
    recognitions: list[EmployeeRecognitionOut] = Field(default_factory=list)
    unified_history: list[UnifiedHistoryItemOut] = Field(default_factory=list)
    updated_at: Optional[datetime] = None


class WorkerDevelopmentPatchIn(BaseModel):
    development_quadrant: Optional[DevelopmentQuadrant] = None
    development_status: Optional[DevelopmentStatus] = None
    manager_notes: Optional[str] = None
    career_goals: Optional[str] = None
    skills: Optional[list[str]] = None
    assessment: Optional[DevelopmentAssessmentIn] = None
    development_plan: Optional[DevelopmentPlanOut] = None
    timeline: Optional[list[DevelopmentTimelineItemOut]] = None
    career: Optional[EmployeeCareerProfileIn] = None
    add_recognition: Optional[EmployeeRecognitionIn] = None
    #: Required when changing quadrant and an existing non-empty plan would be replaced.
    confirm_plan_overwrite: bool = False
    #: When true, completing an assessment update sets last_assessment_at to now.
    record_assessment: bool = False

    @field_validator("development_quadrant", mode="before")
    @classmethod
    def _upper_quadrant(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().upper()
        return v


class WorkerDevelopmentPatchResultOut(BaseModel):
    detail: WorkerDevelopmentDetailOut
    plan_overwrite_required: bool = False
    message: Optional[str] = None
