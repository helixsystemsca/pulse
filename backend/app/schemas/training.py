"""Training / procedure compliance matrix — aligned with frontend `lib/training/types.ts`."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

TrainingTierApi = Literal["mandatory", "high_risk", "general"]

TrainingAssignmentStatusApi = Literal[
    "completed",
    "expiring_soon",
    "expired",
    "pending",
    "revision_pending",
    "not_assigned",
    "in_progress",
    "acknowledged",
    "quiz_failed",
]


class TrainingEmployeeOut(BaseModel):
    id: str
    display_name: str
    department: str = ""
    supervisor_name: Optional[str] = None


class TrainingProgramOut(BaseModel):
    """Maps a CMMS procedure to the frontend `TrainingProgram` shape."""

    id: str
    title: str
    description: str = ""
    tier: TrainingTierApi
    category: str = "procedure"
    revision_number: int
    revision_date: date
    requires_acknowledgement: bool
    requires_knowledge_verification: bool = True
    expiry_months: Optional[int] = None
    due_within_days: Optional[int] = None
    active: bool = True


class TrainingAssignmentOut(BaseModel):
    id: str
    employee_id: str
    training_program_id: str
    assigned_by: Optional[str] = None
    assigned_date: date
    due_date: Optional[date]
    status: TrainingAssignmentStatusApi
    completed_date: Optional[datetime] = None
    expiry_date: Optional[date] = None
    acknowledgement_date: Optional[datetime] = None
    supervisor_signoff: bool = False
    quiz_attempt_count: int = 0
    quiz_latest_score_percent: Optional[int] = None
    quiz_latest_passed: Optional[bool] = None
    verification_first_viewed_at: Optional[datetime] = Field(
        None, description="First content view timestamp for current revision (knowledge verification)."
    )
    verification_last_viewed_at: Optional[datetime] = Field(
        None, description="Most recent view heartbeat for current revision."
    )
    verification_total_view_seconds: int = Field(
        0, description="Accumulated review seconds recorded for current revision."
    )
    quiz_passed_at: Optional[datetime] = Field(
        None, description="When a perfect-score verification quiz was submitted for current revision."
    )


class ProcedureComplianceOut(BaseModel):
    procedure_id: str
    company_id: str
    tier: TrainingTierApi
    due_within_days: Optional[int] = None
    requires_acknowledgement: bool = False
    requires_knowledge_verification: bool = True
    updated_at: datetime
    updated_by_user_id: Optional[str] = None


class ProcedureCompliancePatchIn(BaseModel):
    tier: TrainingTierApi
    due_within_days: Optional[int] = Field(None, ge=1, le=3650)
    requires_acknowledgement: bool
    requires_knowledge_verification: Optional[bool] = None


class ProcedureVerificationViewPostIn(BaseModel):
    accumulated_seconds: int = Field(0, ge=0, le=8 * 3600)


class ProcedureVerificationStateOut(BaseModel):
    revision_number: int
    verification_required: bool
    first_viewed_at: Optional[datetime] = None
    last_viewed_at: Optional[datetime] = None
    total_view_seconds: int = 0
    quiz_passed_at: Optional[datetime] = None
    acknowledged_for_revision: bool = False
    acknowledgement_at: Optional[datetime] = None
    quiz_attempt_count: int = 0
    quiz_latest_score_percent: Optional[int] = None
    can_acknowledge: bool = False
    can_start_quiz: bool = False


class ProcedureQuizStartOut(BaseModel):
    session_id: str
    questions: list[dict] = Field(default_factory=list)


class ProcedureQuizSubmitIn(BaseModel):
    session_id: str
    answers: dict[str, int] = Field(default_factory=dict)


class ProcedureQuizSubmitOut(BaseModel):
    score_percent: int
    correct_count: int
    total_questions: int
    passed: bool
    reveal: dict = Field(default_factory=dict)
    completion_id: Optional[str] = None
    completion_created: bool = False


class ProcedureSignoffPostIn(BaseModel):
    revision_marker: Optional[str] = Field(None, max_length=64)
    employee_id: Optional[str] = Field(None, description="Target worker; managers/supervisors only")
    supervisor_signoff: bool = False


class ProcedureSignoffOut(BaseModel):
    id: str
    revision_marker: str
    created: bool
    # UTC timestamp on the compliance sign-off row (audit archive).
    completed_at: datetime


class ProcedureAcknowledgementOut(BaseModel):
    revision_number: int
    acknowledged_at: datetime


class ProcedureAcknowledgementPostIn(BaseModel):
    employee_id: Optional[str] = None
    read_understood_confirmed: bool = Field(
        False,
        description="Must be true when knowledge verification is required (explicit read/understand acknowledgment).",
    )


class TrainingAssignmentCreateIn(BaseModel):
    procedure_id: str
    employee_user_ids: list[str] = Field(..., min_length=1)
    due_date: Optional[date] = None
    use_compliance_due_window: bool = Field(
        True,
        description="When true and tier has due_within_days, compute due_date from assigned_date.",
    )


class TrainingMatrixOut(BaseModel):
    employees: list[TrainingEmployeeOut]
    programs: list[TrainingProgramOut]
    assignments: list[TrainingAssignmentOut]


class WorkerTrainingOut(BaseModel):
    programs: list[TrainingProgramOut]
    assignments: list[TrainingAssignmentOut]
    acknowledgement_summary: list[dict] = Field(
        default_factory=list,
        description="Raw acknowledgement rows keyed by revision (optional diagnostics).",
    )
