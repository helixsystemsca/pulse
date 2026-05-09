"""Pulse product domain: CMMS work requests, scheduling, worker profiles, beacons."""

import enum
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class PulseWorkRequestStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    hold = "hold"
    completed = "completed"
    cancelled = "cancelled"


class PulseWorkOrderType(str, enum.Enum):
    """Unified maintenance work order classification (legacy rows default to issue)."""

    issue = "issue"
    preventative = "preventative"
    request = "request"


class PulseWorkOrderSource(str, enum.Enum):
    manual = "manual"
    auto_pm = "auto_pm"
    downtime_detected = "downtime_detected"


class PulseWorkRequestPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class PulseProcedure(Base):
    """Reusable step-by-step instructions for work orders and preventative rules."""

    __tablename__ = "pulse_procedures"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    steps: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    # Internal-only labels for filtering / lookup (not shown on worker-facing steps). JSON array of strings.
    search_keywords: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reviewed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revised_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    revised_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    revised_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    content_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProcedureComplianceSettings(Base):
    """Standards/training tier + acknowledgement rules per CMMS procedure (tenant-scoped)."""

    __tablename__ = "pulse_procedure_compliance_settings"

    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="general")
    due_within_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    requires_acknowledgement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class PulseProcedureTrainingAssignment(Base):
    """Training matrix assignment lifecycle (distinct from pulse_procedure_assignments mobile runs)."""

    __tablename__ = "pulse_procedure_training_assignments"
    __table_args__ = (
        UniqueConstraint("company_id", "employee_user_id", "procedure_id", name="uq_pulse_proc_training_assign_emp_proc"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    acknowledgement_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    supervisor_signoff: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProcedureCompletionSignoff(Base):
    __tablename__ = "pulse_procedure_completion_signoffs"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            "revision_marker",
            name="uq_pulse_proc_signoff_idem",
        ),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    revision_marker: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseProcedureTrainingAcknowledgement(Base):
    __tablename__ = "pulse_procedure_acknowledgements"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            "revision_number",
            name="uq_pulse_proc_ack_idem",
        ),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseTrainingNotificationEvent(Base):
    __tablename__ = "pulse_training_notification_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    dedupe_key: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)


class PulseProcedureAssignmentStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class PulseProcedureAssignmentKind(str, enum.Enum):
    complete = "complete"
    revise = "revise"
    create = "create"


class PulseProcedureAssignment(Base):
    """Assign a procedure to a worker for completion (mobile-first)."""

    __tablename__ = "pulse_procedure_assignments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_to_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    kind: Mapped[PulseProcedureAssignmentKind] = mapped_column(
        Enum(PulseProcedureAssignmentKind),
        nullable=False,
        default=PulseProcedureAssignmentKind.complete,
        index=True,
    )
    status: Mapped[PulseProcedureAssignmentStatus] = mapped_column(
        Enum(PulseProcedureAssignmentStatus),
        nullable=False,
        default=PulseProcedureAssignmentStatus.pending,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseRoutine(Base):
    """Routine template: a named checklist with ordered items."""

    __tablename__ = "pulse_routines"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseRoutineItem(Base):
    """Ordered checklist item belonging to a routine template."""

    __tablename__ = "pulse_routine_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(8000), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # When set, applies only to that band (day/afternoon/night); null = any shift (legacy / universal).
    shift_band: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseRoutineRunStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"


class PulseRoutineRun(Base):
    """Execution instance of a routine (compliance record)."""

    __tablename__ = "pulse_routine_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shift_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True, index=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[PulseRoutineRunStatus] = mapped_column(
        Enum(PulseRoutineRunStatus),
        nullable=False,
        default=PulseRoutineRunStatus.in_progress,
        index=True,
    )
    routine_assignment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        CheckConstraint(
            "status in ('in_progress','completed')",
            name="ck_pulse_routine_runs_status",
        ),
    )


class PulseRoutineItemRun(Base):
    """Per-checklist item completion inside a routine run."""

    __tablename__ = "pulse_routine_item_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_run_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    routine_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class PulseRoutineAssignment(Base):
    """Shift-scoped assignment of a routine to a primary worker (and optional delegation)."""

    __tablename__ = "pulse_routine_assignments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_routines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True, index=True)
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    primary_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseRoutineItemAssignment(Base):
    """Delegation of a specific checklist item to a different worker."""

    __tablename__ = "pulse_routine_item_assignments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_assignment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    routine_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseRoutineAssignmentExtra(Base):
    """Ad hoc extra task added to an assignment (can be assigned to any worker)."""

    __tablename__ = "pulse_routine_assignment_extras"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    routine_assignment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_routine_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(8000), nullable=False)
    assigned_to_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PulseProcedureAssignmentPhoto(Base):
    """Photo evidence attached to a procedure assignment (worker upload)."""

    __tablename__ = "pulse_procedure_assignment_photos"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assignment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_procedure_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    photo_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False, server_default=text("'image/jpeg'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class PulsePreventativeRule(Base):
    """Preventative maintenance rule: asset + frequency + optional procedure (no auto-scheduling yet)."""

    __tablename__ = "pulse_preventative_rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    equipment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="CASCADE"), nullable=False, index=True
    )
    frequency: Mapped[str] = mapped_column(String(128), nullable=False)
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulsePmPlan(Base):
    """
    Soft-start preventative maintenance plan.

    Phase 1: lightweight recurring schedule that generates Work Requests (type=preventative_maintenance).
    Phase 2+: optional structured links (equipment/template) + metadata expansion.
    """

    __tablename__ = "pulse_pm_plans"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    frequency: Mapped[str] = mapped_column(String(16), nullable=False)  # daily | weekly | monthly | annual | custom
    custom_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_time_offset_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Optional structure (nullable for now).
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    # DB column "metadata" — Python name cannot be `metadata` (reserved on DeclarativeBase).
    plan_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    last_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseWorkRequest(Base):
    __tablename__ = "pulse_work_requests"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pm_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pm_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pm_plan_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_pm_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    part_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("equipment_parts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    work_request_kind: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    priority: Mapped[PulseWorkRequestPriority] = mapped_column(
        Enum(PulseWorkRequestPriority, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=PulseWorkRequestPriority.medium,
        nullable=False,
    )
    status: Mapped[PulseWorkRequestStatus] = mapped_column(
        Enum(PulseWorkRequestStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        default=PulseWorkRequestStatus.open,
        nullable=False,
        index=True,
    )
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    work_order_type: Mapped[PulseWorkOrderType] = mapped_column(
        Enum(PulseWorkOrderType, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=PulseWorkOrderType.issue,
        nullable=False,
        index=True,
    )
    work_order_source: Mapped[PulseWorkOrderSource] = mapped_column(
        Enum(PulseWorkOrderSource, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        default=PulseWorkOrderSource.manual,
        nullable=False,
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    attachments: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseWorkRequestComment(Base):
    __tablename__ = "pulse_work_request_comments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    work_request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class PulseWorkRequestActivity(Base):
    __tablename__ = "pulse_work_request_activity"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    work_request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    performed_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class PulseWorkRequestSettings(Base):
    """Per-tenant JSON config for work-request UX (statuses, SLA hours, toggles)."""

    __tablename__ = "pulse_work_request_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseOrgModuleSettings(Base):
    """Unified per-tenant module toggles (work requests, schedule, assets, blueprint, compliance)."""

    __tablename__ = "pulse_org_module_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseWorkerProfile(Base):
    """Certifications, notes, and weekly availability windows for scheduling hints."""

    __tablename__ = "pulse_worker_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_pulse_worker_profiles_user"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certifications: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    availability: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    scheduling: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProjectStatus(str, enum.Enum):
    active = "active"
    future = "future"
    completed = "completed"
    on_hold = "on_hold"
    archived = "archived"


class PulseTaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class PulseTaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    complete = "complete"


class PulseProjectAutomationTrigger(str, enum.Enum):
    task_status_changed = "task_status_changed"
    task_completed = "task_completed"
    task_overdue = "task_overdue"
    proximity_missed = "proximity_missed"
    task_stale = "task_stale"


class PulseProjectPhase(str, enum.Enum):
    initiation = "Initiation"
    planning = "Planning"
    execution = "Execution"
    monitoring = "Monitoring"
    closing = "Closing"


class PulseProjectActivityType(str, enum.Enum):
    task = "task"
    issue = "issue"
    decision = "decision"
    change = "change"
    note = "note"


class PulseProjectActivityImpactLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PulseCategory(Base):
    __tablename__ = "pulse_categories"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_pulse_category_company_name"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Store token-like color keys (e.g. "ds-success") or empty.
    color: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseProject(Base):
    __tablename__ = "pulse_projects"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success_definition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_phase: Mapped[Optional[PulseProjectPhase]] = mapped_column(
        Enum(PulseProjectPhase, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=True,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[PulseProjectStatus] = mapped_column(
        Enum(PulseProjectStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        default=PulseProjectStatus.active,
        nullable=False,
        index=True,
    )
    repopulation_frequency: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    notification_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    notification_material_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30, server_default="30"
    )
    notification_equipment_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=7, server_default="7"
    )
    notification_to_supervision: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    notification_to_lead: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    notification_to_owner: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProjectActivity(Base):
    __tablename__ = "pulse_project_activity"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[PulseProjectActivityType] = mapped_column(
        Enum(
            PulseProjectActivityType,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
            length=16,
        ),
        nullable=False,
        index=True,
    )
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact_level: Mapped[Optional[PulseProjectActivityImpactLevel]] = mapped_column(
        Enum(
            PulseProjectActivityImpactLevel,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
            length=16,
        ),
        nullable=True,
    )
    related_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class PulseProjectTemplate(Base):
    __tablename__ = "pulse_project_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_success_definition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProjectTemplateTask(Base):
    __tablename__ = "pulse_project_template_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    template_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_duration: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    skill_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    material_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    phase_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseProjectCriticalStep(Base):
    __tablename__ = "pulse_project_critical_steps"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    depends_on_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_critical_steps.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseProjectTask(Base):
    __tablename__ = "pulse_project_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    priority: Mapped[PulseTaskPriority] = mapped_column(
        Enum(PulseTaskPriority, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=PulseTaskPriority.medium,
        nullable=False,
    )
    status: Mapped[PulseTaskStatus] = mapped_column(
        Enum(PulseTaskStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        default=PulseTaskStatus.todo,
        nullable=False,
        index=True,
    )
    # Preferred lightweight planning fields (date + estimate) used by the PM UI.
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    estimated_completion_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Filled automatically when a task is completed; used for estimate vs actual.
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    actual_completion_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Legacy fields (kept for backward compatibility with existing clients and reports).
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    estimated_duration: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    skill_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    material_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phase_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    planned_start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    planned_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    location_tag_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    sop_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    required_skill_names: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    calendar_shift_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_schedule_shifts.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProjectTaskMaterial(Base):
    """Materials required for a project task (can link to inventory items)."""

    __tablename__ = "pulse_project_task_materials"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inventory_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity_required: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="in_stock",
        server_default=text("'in_stock'"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseProjectTaskEquipment(Base):
    """Facility equipment linked to a project task (inspection / work context)."""

    __tablename__ = "pulse_project_task_equipment"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    facility_equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("facility_equipment.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseTaskDependency(Base):
    """Task T is blocked until prerequisite P is complete: task_id=T, depends_on_task_id=P."""

    __tablename__ = "pulse_task_dependencies"
    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_pulse_task_dep_pair"),
        CheckConstraint("task_id <> depends_on_task_id", name="ck_pulse_task_dep_no_self"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    depends_on_task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class PulseProximityEventLog(Base):
    """Worker offered ready tasks at a location; tracks resolution or missed opportunity."""

    __tablename__ = "pulse_proximity_events_log"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_tag_id: Mapped[str] = mapped_column(String(128), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    tasks_present: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    action_taken: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    action_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_project_tasks.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_missed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    missed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class PulseUserPerformanceSnapshot(Base):
    """Cached per-user performance metrics for a time window (dashboard / trends)."""

    __tablename__ = "pulse_user_performance_snapshots"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", "time_window", name="uq_pulse_perf_snap_user_company_window"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_window: Mapped[str] = mapped_column(String(16), nullable=False)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PulseProjectAutomationRule(Base):
    """Lightweight per-project automation (triggers + JSON condition/action)."""

    __tablename__ = "pulse_project_automation_rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger_type: Mapped[PulseProjectAutomationTrigger] = mapped_column(
        Enum(
            PulseProjectAutomationTrigger,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
            length=32,
        ),
        nullable=False,
    )
    condition_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    action_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseScheduleShift(Base):
    __tablename__ = "pulse_schedule_shifts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    facility_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shift_definition_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_schedule_shift_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    shift_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(64), default="shift", nullable=False)
    requires_supervisor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_ticketed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shift_kind: Mapped[str] = mapped_column(String(32), default="workforce", nullable=False)
    display_label: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseScheduleShiftDefinition(Base):
    __tablename__ = "pulse_schedule_shift_definitions"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_sched_shift_def_company_code"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    start_min: Mapped[int] = mapped_column(Integer, nullable=False)
    end_min: Mapped[int] = mapped_column(Integer, nullable=False)
    shift_type: Mapped[str] = mapped_column(String(32), nullable=False, default="day")
    color: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    cert_requirements: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseSchedulePeriod(Base):
    __tablename__ = "pulse_schedule_periods"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    availability_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    publish_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PulseScheduleAvailabilitySubmission(Base):
    __tablename__ = "pulse_schedule_availability_submissions"
    __table_args__ = (UniqueConstraint("worker_id", "period_id", name="uq_sched_avail_worker_period"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_schedule_periods.id", ondelete="CASCADE"), nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    windows: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    exceptions: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))


class PulseScheduleAcknowledgement(Base):
    __tablename__ = "pulse_schedule_acknowledgements"
    __table_args__ = (UniqueConstraint("worker_id", "period_id", name="uq_sched_ack_worker_period"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_schedule_periods.id", ondelete="CASCADE"), nullable=False
    )
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PulseScheduleAssignment(Base):
    """
    Per-day shift assignments (area + notes) that sit alongside workforce shifts.
    Intended for "night shift assignments" style checklists.
    """

    __tablename__ = "pulse_schedule_assignments"
    __table_args__ = (UniqueConstraint("company_id", "date", "shift_type", "area", name="uq_pulse_schedule_assign_area"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(32), default="night", nullable=False, index=True)
    area: Mapped[str] = mapped_column(String(128), nullable=False)
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseBeaconEquipment(Base):
    __tablename__ = "pulse_beacon_equipment"
    __table_args__ = (UniqueConstraint("company_id", "beacon_id", name="uq_pulse_beacon_company_beacon"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    beacon_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    location_label: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    photo_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseWorkerHR(Base):
    """HR / roster fields for tenant users (1:1 with `users`)."""

    __tablename__ = "pulse_worker_hr"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    shift: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    supervisor_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    supervisor_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseWorkerCertification(Base):
    __tablename__ = "pulse_worker_certifications"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseWorkerSkill(Base):
    __tablename__ = "pulse_worker_skills"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseWorkerTraining(Base):
    __tablename__ = "pulse_worker_training"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseWorkersSettings(Base):
    """Company-level workers module config (permission matrix, shifts, skill tags, rules)."""

    __tablename__ = "pulse_workers_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class NotificationRule(Base):
    """Project-scoped notification rule (relative offset + JSON conditions + recipients)."""

    __tablename__ = "notification_rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    offset_days: Mapped[int] = mapped_column(Integer, nullable=False)
    conditions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    recipients: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class NotificationLog(Base):
    """Audit log for each rule evaluation (triggered or skipped)."""

    __tablename__ = "notification_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("notification_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    triggered: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    recipients_resolved: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
