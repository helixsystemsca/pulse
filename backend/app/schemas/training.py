"""Training / procedure compliance matrix — aligned with frontend `lib/training/types.ts`."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

MatrixShiftBandApi = Literal["day", "afternoon", "night"]

TrainingTierApi = Literal["mandatory", "high_risk", "general"]

ALLOWED_PROCEDURE_TRACKING_TAGS: frozenset[str] = frozenset(
    {"general", "high", "emergency", "routine", "safety"},
)


def normalize_procedure_tracking_tags(raw: object) -> list[str]:
    """Dedupe and restrict to allowed tag ids (stable order)."""
    if not raw or not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        s = str(item).strip().lower()
        if s in ALLOWED_PROCEDURE_TRACKING_TAGS and s not in out:
            out.append(s)
    return out

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
    "not_applicable",
]

MatrixAdminOverrideApi = Literal["force_complete", "force_incomplete", "force_na"]


class TrainingEmployeeOut(BaseModel):
    id: str
    display_name: str
    department: str = ""
    supervisor_name: Optional[str] = None
    employment_type: Optional[str] = Field(
        None,
        description="From worker profile scheduling (full_time | regular_part_time | part_time).",
    )
    matrix_shift_band: Optional[MatrixShiftBandApi] = Field(
        None,
        description="Day / afternoon / night inferred from HR.shift for matrix shift-scoped procedures.",
    )


class TrainingProgramOut(BaseModel):
    """Maps a CMMS procedure to the frontend `TrainingProgram` shape."""

    id: str
    title: str
    description: str = ""
    tier: TrainingTierApi
    program_type: str = Field("procedure", description="Asset kind (procedure-backed SOP, …).")
    category: str = Field(
        "General",
        description="Curriculum / topical grouping (from procedure `procedure_category` when set).",
    )
    department_category: str = Field(
        "",
        description="Owning department slug (maintenance, aquatics, …); empty = organization-wide.",
    )
    revision_number: int
    revision_date: date
    requires_acknowledgement: bool
    requires_knowledge_verification: bool = True
    expiry_months: Optional[int] = None
    due_within_days: Optional[int] = None
    active: bool = True
    tracking_tags: list[str] = Field(default_factory=list, description="Procedure data tags: general, high, …")
    onboarding_required: bool = Field(
        False,
        description="When true, counts toward leadership onboarding / fully-trained checklist for this tag set.",
    )


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
    matrix_admin_override: Optional[MatrixAdminOverrideApi] = Field(
        None,
        description="Company-admin matrix display override; null = use computed compliance status.",
    )


class TrainingAssignmentMatrixOverrideIn(BaseModel):
    matrix_admin_override: Optional[MatrixAdminOverrideApi] = Field(
        None,
        description="Set force_complete / force_incomplete / force_na (not applicable), or null to clear.",
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
    tracking_tags: list[str] = Field(default_factory=list)
    onboarding_required: bool = False


class ProcedureCompliancePatchIn(BaseModel):
    tier: TrainingTierApi
    due_within_days: Optional[int] = Field(None, ge=1, le=3650)
    requires_acknowledgement: bool
    requires_knowledge_verification: Optional[bool] = None
    tracking_tags: Optional[list[str]] = None
    onboarding_required: Optional[bool] = None

    @field_validator("tracking_tags", mode="before")
    @classmethod
    def _norm_tracking_tags(cls, v: object) -> Optional[list[str]]:
        if v is None:
            return None
        return normalize_procedure_tracking_tags(v)


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
    id: str
    revision_number: int
    acknowledged_at: datetime
    acknowledgment_statement: Optional[str] = None
    snapshot_id: Optional[str] = Field(None, description="Immutable snapshot row used for audit PDF (null if duplicate ack).")


class ProcedureAcknowledgementPostIn(BaseModel):
    employee_id: Optional[str] = None
    read_understood_confirmed: bool = Field(
        False,
        description="Must be true when knowledge verification is required (explicit read/understand acknowledgment).",
    )
    statement_confirmed: bool = Field(
        False,
        description="Must be true — worker attests to the standard acknowledgment text before recording.",
    )
    acknowledgment_note: Optional[str] = Field(None, max_length=2000)


class ProcedureAcknowledgmentArchiveItemOut(BaseModel):
    id: str
    employee_user_id: str
    employee_name: str
    procedure_id: str
    procedure_title: str
    acknowledged_revision: int
    procedure_current_revision: int
    acknowledged_at: datetime
    acknowledgment_statement: Optional[str] = None
    acknowledgment_note: Optional[str] = None
    compliance_status: Literal["current", "outdated"]
    snapshot_id: Optional[str] = None
    pdf_ready: bool = False
    pdf_generation_error: Optional[str] = None


class ProcedureAcknowledgmentComplianceRecordOut(BaseModel):
    """Immutable acknowledgment audit record (snapshot + status vs current procedure revision)."""

    acknowledgment_id: str
    snapshot_id: str
    immutable: Literal[True] = True
    employee_user_id: str
    procedure_id: str
    procedure_title_snapshot: str
    procedure_category_snapshot: Optional[str] = None
    procedure_semantic_version_snapshot: Optional[str] = None
    procedure_version_snapshot: int
    procedure_revision_date_snapshot: Optional[date] = None
    procedure_revision_summary_snapshot: Optional[str] = None
    procedure_content_snapshot: list[Any] = Field(default_factory=list)
    acknowledgment_statement_text: str
    acknowledgment_note: Optional[str] = None
    acknowledged_at: datetime
    worker_full_name: Optional[str] = None
    worker_job_title: Optional[str] = None
    worker_operational_role: Optional[str] = None
    snapshot_created_at: datetime
    generated_pdf_ready: bool = False
    pdf_generation_error: Optional[str] = None
    procedure_current_revision: int
    compliance_status: Literal["current", "outdated"]


class ProcedureAcknowledgmentArchivePageOut(BaseModel):
    items: list[ProcedureAcknowledgmentArchiveItemOut]
    total: int
    limit: int
    offset: int


ProcedureLightCompletionStatusApi = Literal[
    "not_started",
    "completed",
    "expired",
    "requires_retraining",
]


class ProcedureLightCompletionStateOut(BaseModel):
    """Worker-facing training / compliance status for lightweight procedure completion."""

    status: ProcedureLightCompletionStatusApi
    current_revision_number: int
    completed_at: Optional[datetime] = None
    completed_revision_number: Optional[int] = None
    expires_at: Optional[date] = None
    primary_acknowledged_at: Optional[datetime] = None
    secondary_acknowledged_at: Optional[datetime] = None
    quiz_score_percent: Optional[int] = None


class ProcedureLightCompletionPostIn(BaseModel):
    primary_acknowledged: bool = Field(False, description="Required to complete when verification is off.")
    secondary_acknowledged: bool = Field(
        False,
        description="Required for critical procedures — confirm escalation if unsure.",
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
    employment_type: Optional[str] = Field(
        None,
        description="Scheduling employment type for the worker whose bundle this is.",
    )
    matrix_shift_band: Optional[MatrixShiftBandApi] = Field(
        None,
        description="Inferred shift band for shift-scoped matrix columns (full-time filter on the client).",
    )
