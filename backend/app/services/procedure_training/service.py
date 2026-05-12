"""Procedure training matrix: statuses, acknowledgement, overdue notification placeholders."""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Literal, Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import (
    PulseProcedure,
    PulseProcedureAcknowledgmentSnapshot,
    PulseProcedureComplianceSettings,
    PulseProcedureCompletionSignoff,
    PulseProcedureTrainingAcknowledgement,
    PulseProcedureTrainingAssignment,
    PulseProcedureWorkerCompletion,
    PulseTrainingNotificationEvent,
)


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

_EXPIRING_SOON_DAYS = 14

STANDARD_PROCEDURE_ACK_STATEMENT = (
    "I acknowledge that I have reviewed and understood this procedure and agree to follow it while performing related duties."
)


def revision_marker_from_procedure(proc: PulseProcedure) -> str:
    return str(int(proc.content_revision or 1))


def resolve_compliance_defaults(
    cs: PulseProcedureComplianceSettings | None,
) -> tuple[str, bool, Optional[int]]:
    tier = cs.tier if cs else "general"
    req_ack = bool(cs.requires_acknowledgement) if cs else False
    due_within = cs.due_within_days if cs else None
    return tier, req_ack, due_within


def verification_requires_quiz(cs: PulseProcedureComplianceSettings | None) -> bool:
    """When true, matrix completion requires view → acknowledge → 100% quiz (sign-off row)."""
    if cs is None:
        return True
    return bool(getattr(cs, "requires_knowledge_verification", True))


def _ack_satisfied(proc_rev: int, latest_ack_rev: Optional[int], requires_ack: bool) -> bool:
    if not requires_ack:
        return True
    return latest_ack_rev is not None and latest_ack_rev >= proc_rev


def compute_training_assignment_status(
    *,
    assignment: PulseProcedureTrainingAssignment | None,
    procedure: PulseProcedure,
    compliance: PulseProcedureComplianceSettings | None,
    latest_ack_revision: Optional[int],
    signoff_for_current_revision: bool,
    engagement_first_viewed_at: Optional[datetime] = None,
    engagement_quiz_passed_at: Optional[datetime] = None,
    quiz_attempt_count: int = 0,
    quiz_latest_passed: Optional[bool] = None,
    latest_worker_completion: Optional[PulseProcedureWorkerCompletion] = None,
) -> TrainingAssignmentStatusApi:
    if assignment is None:
        return "not_assigned"

    tier, req_ack, _ = resolve_compliance_defaults(compliance)
    proc_rev = int(procedure.content_revision or 1)
    today = datetime.now(timezone.utc).date()

    v_on = verification_requires_quiz(compliance)
    lw = latest_worker_completion
    if not v_on and lw is not None:
        if lw.expires_at is not None and today > lw.expires_at:
            return "expired"
        if int(lw.revision_number) < proc_rev:
            return "revision_pending"
    if v_on:
        ack_ok = latest_ack_revision is not None and latest_ack_revision >= proc_rev
    else:
        ack_ok = _ack_satisfied(proc_rev, latest_ack_revision, req_ack)

    if v_on:
        stale_completed = assignment.completed_at is not None and not signoff_for_current_revision
        if stale_completed and req_ack and not ack_ok:
            return "revision_pending"

        if req_ack and not ack_ok:
            return "revision_pending"

        if signoff_for_current_revision and ack_ok:
            exp = assignment.expiry_date
            if exp is not None:
                if today > exp:
                    return "expired"
                days_left = (exp - today).days
                if 0 <= days_left <= _EXPIRING_SOON_DAYS:
                    return "expiring_soon"
            return "completed"

        if tier == "mandatory" and assignment.due_date is not None and today > assignment.due_date:
            if not signoff_for_current_revision:
                return "expired"

        viewed = engagement_first_viewed_at is not None
        quiz_passed = engagement_quiz_passed_at is not None
        if quiz_attempt_count > 0 and not quiz_passed and quiz_latest_passed is False:
            return "quiz_failed"
        if ack_ok and not quiz_passed:
            return "acknowledged"
        if viewed and not ack_ok:
            return "in_progress"
        return "pending"

    # Legacy: verification disabled — completion follows assignment timestamps + acknowledgement alignment.
    has_completion = assignment.completed_at is not None
    if has_completion and req_ack and not ack_ok:
        return "revision_pending"

    if has_completion and ack_ok:
        exp = assignment.expiry_date
        if exp is not None:
            if today > exp:
                return "expired"
            days_left = (exp - today).days
            if 0 <= days_left <= _EXPIRING_SOON_DAYS:
                return "expiring_soon"
        return "completed"

    if tier == "mandatory" and assignment.due_date is not None and today > assignment.due_date:
        return "expired"

    return "pending"


def _as_utc_date(d: date) -> str:
    return d.isoformat()


async def enqueue_mandatory_overdue_if_needed(
    db: AsyncSession,
    company_id: str,
    *,
    assignment: PulseProcedureTrainingAssignment,
    procedure_id: str,
    employee_user_id: str,
    compliance: PulseProcedureComplianceSettings | None,
    latest_ack_revision: Optional[int],
    procedure: PulseProcedure,
    as_of: date,
    signoff_for_current_revision: bool = False,
) -> None:
    tier, req_ack, _ = resolve_compliance_defaults(compliance)
    if tier != "mandatory":
        return
    if assignment.due_date is None or as_of <= assignment.due_date:
        return
    proc_rev = int(procedure.content_revision or 1)
    v_on = verification_requires_quiz(compliance)
    if v_on:
        ack_ok_ov = latest_ack_revision is not None and latest_ack_revision >= proc_rev
    else:
        ack_ok_ov = _ack_satisfied(proc_rev, latest_ack_revision, req_ack)
    if v_on:
        if signoff_for_current_revision and ack_ok_ov:
            return
    elif assignment.completed_at is not None and ack_ok_ov:
        return

    dedupe_key = f"mandatory_overdue:{company_id}:{employee_user_id}:{procedure_id}:{as_of.isoformat()}"
    stmt = (
        insert(PulseTrainingNotificationEvent)
        .values(
            id=str(uuid4()),
            company_id=company_id,
            kind="mandatory_overdue",
            payload={
                "employee_user_id": str(employee_user_id),
                "procedure_id": str(procedure_id),
                "due_date": _as_utc_date(assignment.due_date),
                "as_of": as_of.isoformat(),
            },
            dedupe_key=dedupe_key,
        )
        .on_conflict_do_nothing(index_elements=["dedupe_key"])
    )
    await db.execute(stmt)


async def record_procedure_acknowledgement(
    db: AsyncSession,
    company_id: str,
    *,
    employee_user_id: str,
    procedure: PulseProcedure,
    acknowledgment_statement: str | None = None,
    acknowledgment_note: str | None = None,
) -> tuple[PulseProcedureTrainingAcknowledgement, bool, str | None]:
    now = datetime.now(timezone.utc)
    rev = int(procedure.content_revision or 1)
    exist = await db.execute(
        select(PulseProcedureTrainingAcknowledgement).where(
            PulseProcedureTrainingAcknowledgement.company_id == company_id,
            PulseProcedureTrainingAcknowledgement.employee_user_id == employee_user_id,
            PulseProcedureTrainingAcknowledgement.procedure_id == str(procedure.id),
            PulseProcedureTrainingAcknowledgement.revision_number == rev,
        )
    )
    hit = exist.scalar_one_or_none()
    if hit:
        return hit, False, None

    stmt_text = (acknowledgment_statement or "").strip() or STANDARD_PROCEDURE_ACK_STATEMENT
    note_raw = (acknowledgment_note or "").strip()
    note = note_raw[:2000] if note_raw else None

    row = PulseProcedureTrainingAcknowledgement(
        id=str(uuid4()),
        company_id=company_id,
        employee_user_id=employee_user_id,
        procedure_id=str(procedure.id),
        revision_number=rev,
        acknowledged_at=now,
        acknowledgment_statement=stmt_text,
        acknowledgment_note=note,
    )
    db.add(row)

    q = await db.execute(
        select(PulseProcedureTrainingAssignment).where(
            PulseProcedureTrainingAssignment.company_id == company_id,
            PulseProcedureTrainingAssignment.employee_user_id == employee_user_id,
            PulseProcedureTrainingAssignment.procedure_id == str(procedure.id),
        )
    )
    assign = q.scalar_one_or_none()
    if assign:
        assign.acknowledgement_at = now
        assign.updated_at = now

    await db.flush()

    worker = await db.get(User, employee_user_id)
    steps_src = procedure.steps
    snapshot_steps: list = deepcopy(steps_src) if isinstance(steps_src, list) else []

    snap = PulseProcedureAcknowledgmentSnapshot(
        id=str(uuid4()),
        acknowledgment_id=str(row.id),
        procedure_id=str(procedure.id),
        procedure_version=rev,
        procedure_title=str(procedure.title or "").strip() or "—",
        procedure_category=(str(procedure.procedure_category).strip() if procedure.procedure_category else None),
        procedure_semantic_version=(str(procedure.semantic_version).strip() if procedure.semantic_version else None),
        procedure_revision_date=procedure.revision_date,
        procedure_revision_summary=(str(procedure.revision_notes).strip() if procedure.revision_notes else None),
        procedure_content_snapshot=snapshot_steps,
        acknowledgment_statement_text=stmt_text,
        acknowledged_at=now,
        worker_full_name=(str(worker.full_name).strip() if worker and worker.full_name else None),
        worker_job_title=(str(worker.job_title).strip() if worker and worker.job_title else None),
        worker_operational_role=(
            str(worker.operational_role).strip() if worker and worker.operational_role else None
        ),
    )
    db.add(snap)
    await db.flush()
    return row, True, str(snap.id)


async def record_procedure_signoff(
    db: AsyncSession,
    company_id: str,
    *,
    employee_user_id: str,
    procedure: PulseProcedure,
    completed_by_user_id: str,
    supervisor_signoff: bool,
    revision_marker: str,
) -> tuple[PulseProcedureCompletionSignoff, bool]:
    """Insert sign-off if missing (idempotent on company, employee, procedure, revision_marker)."""
    now = datetime.now(timezone.utc)
    exist = await db.execute(
        select(PulseProcedureCompletionSignoff).where(
            PulseProcedureCompletionSignoff.company_id == company_id,
            PulseProcedureCompletionSignoff.employee_user_id == employee_user_id,
            PulseProcedureCompletionSignoff.procedure_id == str(procedure.id),
            PulseProcedureCompletionSignoff.revision_marker == revision_marker,
        )
    )
    hit = exist.scalar_one_or_none()
    if hit:
        return hit, False

    row = PulseProcedureCompletionSignoff(
        id=str(uuid4()),
        company_id=company_id,
        employee_user_id=employee_user_id,
        procedure_id=str(procedure.id),
        completed_at=now,
        completed_by_user_id=completed_by_user_id,
        revision_marker=revision_marker,
    )
    db.add(row)

    aq = await db.execute(
        select(PulseProcedureTrainingAssignment).where(
            PulseProcedureTrainingAssignment.company_id == company_id,
            PulseProcedureTrainingAssignment.employee_user_id == employee_user_id,
            PulseProcedureTrainingAssignment.procedure_id == str(procedure.id),
        )
    )
    assign = aq.scalar_one_or_none()
    if assign is None:
        assign = PulseProcedureTrainingAssignment(
            id=str(uuid4()),
            company_id=company_id,
            employee_user_id=employee_user_id,
            procedure_id=str(procedure.id),
            assigned_by_user_id=None,
            assigned_date=now.date(),
            due_date=None,
            supervisor_signoff=supervisor_signoff,
        )
        db.add(assign)
    assign.completed_at = now
    assign.supervisor_signoff = supervisor_signoff or assign.supervisor_signoff
    assign.updated_at = now

    await db.flush()
    return row, True


async def load_latest_worker_completions_map(
    db: AsyncSession,
    company_id: str,
    employee_ids: list[str],
    procedure_ids: list[str],
) -> dict[tuple[str, str], PulseProcedureWorkerCompletion]:
    """Latest lightweight completion row per (employee, procedure) by highest revision_number."""
    if not employee_ids or not procedure_ids:
        return {}
    q = await db.execute(
        select(PulseProcedureWorkerCompletion).where(
            PulseProcedureWorkerCompletion.company_id == company_id,
            PulseProcedureWorkerCompletion.employee_user_id.in_(employee_ids),
            PulseProcedureWorkerCompletion.procedure_id.in_(procedure_ids),
        )
    )
    rows = list(q.scalars().all())
    best: dict[tuple[str, str], PulseProcedureWorkerCompletion] = {}
    for r in rows:
        k = (str(r.employee_user_id), str(r.procedure_id))
        cur = best.get(k)
        if cur is None or int(r.revision_number) > int(cur.revision_number):
            best[k] = r
    return best


async def latest_ack_revision_map(
    db: AsyncSession,
    company_id: str,
    employee_ids: list[str],
    procedure_ids: list[str],
) -> dict[tuple[str, str], int]:
    if not employee_ids or not procedure_ids:
        return {}
    q = await db.execute(
        select(
            PulseProcedureTrainingAcknowledgement.employee_user_id,
            PulseProcedureTrainingAcknowledgement.procedure_id,
            func.max(PulseProcedureTrainingAcknowledgement.revision_number).label("mx"),
        )
        .where(
            PulseProcedureTrainingAcknowledgement.company_id == company_id,
            PulseProcedureTrainingAcknowledgement.employee_user_id.in_(employee_ids),
            PulseProcedureTrainingAcknowledgement.procedure_id.in_(procedure_ids),
        )
        .group_by(
            PulseProcedureTrainingAcknowledgement.employee_user_id,
            PulseProcedureTrainingAcknowledgement.procedure_id,
        )
    )
    out: dict[tuple[str, str], int] = {}
    for uid, pid, mx in q.all():
        out[(str(uid), str(pid))] = int(mx or 0)
    return out
