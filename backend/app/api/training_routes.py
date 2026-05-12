"""Procedure training matrix and bulk assignments (`/api/v1/training/*`)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any, Literal, Optional, cast
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company_admin, require_training_matrix_access, require_tenant_user
from app.models.domain import User, UserRole
from app.models.pulse_models import (
    PulseProcedure,
    PulseProcedureComplianceSettings,
    PulseProcedureTrainingAcknowledgement,
    PulseProcedureTrainingAssignment,
    PulseProcedureWorkerCompletion,
    PulseWorkerHR,
    PulseWorkerProfile,
)
from app.modules.pulse import service as pulse_svc
from app.schemas.maintenance_hub import normalize_procedure_steps
from app.schemas.training import (
    TrainingAssignmentCreateIn,
    TrainingAssignmentMatrixOverrideIn,
    TrainingAssignmentOut,
    TrainingEmployeeOut,
    TrainingMatrixOut,
    TrainingProgramOut,
    WorkerTrainingOut,
)
from app.services.procedure_training.service import (
    compute_training_assignment_status,
    enqueue_mandatory_overdue_if_needed,
    latest_ack_revision_map,
    load_latest_worker_completions_map,
    resolve_compliance_defaults,
    revision_marker_from_procedure,
    verification_requires_quiz,
)
from app.services.procedure_verification.service import (
    EngagementSnapshot,
    QuizAttemptStats,
    load_attempt_stats_for_pairs,
    load_engagement_map,
    load_signoff_keys,
)
from app.services.training_matrix_shift_scope import (
    employment_type_from_scheduling,
    matrix_shift_band_from_roster_shift,
    worker_should_see_procedure_for_shift_scoping,
)

router = APIRouter(prefix="/training", tags=["training"])

Db = Annotated[AsyncSession, Depends(get_db)]

# Users who appear as rows on the team training matrix. Managers and supervisors are excluded so the
# matrix tracks frontline / operational staff; those roles can still open the matrix via ACL.
_TRAINING_MATRIX_ROW_ROLES = (
    UserRole.company_admin,
    UserRole.lead,
    UserRole.worker,
)

TrainingTierApi = Literal["mandatory", "high_risk", "general"]


async def _company_id(user: Annotated[User, Depends(require_tenant_user)]) -> str:
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company context required")
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]


def _procedure_to_program(p: PulseProcedure, cs: PulseProcedureComplianceSettings | None) -> TrainingProgramOut:
    tier, req_ack, due_w = resolve_compliance_defaults(cs)
    if tier not in ("mandatory", "high_risk", "general"):
        tier = "general"
    tier_t = cast(TrainingTierApi, tier)
    steps = normalize_procedure_steps(p.steps)
    desc = (steps[0].content[:500] if steps else "") or ""
    rev_date = p.updated_at.date() if p.updated_at else datetime.now(timezone.utc).date()
    return TrainingProgramOut(
        id=str(p.id),
        title=p.title,
        description=desc,
        tier=tier_t,
        category="procedure",
        revision_number=int(p.content_revision or 1),
        revision_date=rev_date,
        requires_acknowledgement=req_ack,
        requires_knowledge_verification=verification_requires_quiz(cs),
        expiry_months=None,
        due_within_days=due_w,
        active=True,
    )


def _assignment_to_out(
    row: PulseProcedureTrainingAssignment,
    proc: PulseProcedure,
    cs: PulseProcedureComplianceSettings | None,
    latest_ack: Optional[int],
    employee_user_id: str,
    signoff_set: set[tuple[str, str, str]],
    engagement_map: dict[tuple[str, str], EngagementSnapshot],
    attempt_map: dict[tuple[str, str], QuizAttemptStats],
    worker_completion_map: dict[tuple[str, str], PulseProcedureWorkerCompletion] | None = None,
) -> TrainingAssignmentOut:
    proc_id = str(proc.id)
    marker = revision_marker_from_procedure(proc)
    sig_ok = (employee_user_id, proc_id, marker) in signoff_set
    eng = engagement_map.get((employee_user_id, proc_id))
    att = attempt_map.get((employee_user_id, proc_id), QuizAttemptStats(0, None, None))
    lw = (worker_completion_map or {}).get((employee_user_id, proc_id))
    st = compute_training_assignment_status(
        assignment=row,
        procedure=proc,
        compliance=cs,
        latest_ack_revision=latest_ack,
        signoff_for_current_revision=sig_ok,
        engagement_first_viewed_at=eng.first_viewed_at if eng else None,
        engagement_quiz_passed_at=eng.quiz_passed_at if eng else None,
        quiz_attempt_count=att.attempt_count,
        quiz_latest_passed=att.latest_passed,
        latest_worker_completion=lw,
    )
    ov = row.matrix_admin_override
    ov_t: Optional[Literal["force_complete", "force_incomplete", "force_na"]] = None
    if ov == "force_complete":
        ov_t = "force_complete"
        st = "completed"
    elif ov == "force_incomplete":
        ov_t = "force_incomplete"
        st = "pending"
    elif ov == "force_na":
        ov_t = "force_na"
        st = "not_applicable"
    return TrainingAssignmentOut(
        id=str(row.id),
        employee_id=str(row.employee_user_id),
        training_program_id=str(row.procedure_id),
        assigned_by=str(row.assigned_by_user_id) if row.assigned_by_user_id else None,
        assigned_date=row.assigned_date,
        due_date=row.due_date,
        status=st,
        completed_date=row.completed_at,
        expiry_date=row.expiry_date,
        acknowledgement_date=row.acknowledgement_at,
        supervisor_signoff=bool(row.supervisor_signoff),
        quiz_attempt_count=att.attempt_count,
        quiz_latest_score_percent=att.latest_score_percent,
        quiz_latest_passed=att.latest_passed,
        verification_first_viewed_at=eng.first_viewed_at if eng else None,
        verification_last_viewed_at=eng.last_viewed_at if eng else None,
        verification_total_view_seconds=int(eng.total_view_seconds or 0) if eng else 0,
        quiz_passed_at=eng.quiz_passed_at if eng else None,
        matrix_admin_override=ov_t,
    )


@router.get("/matrix", response_model=TrainingMatrixOut)
async def training_matrix(
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_training_matrix_access)],
) -> TrainingMatrixOut:
    roster_vals = [r.value for r in _TRAINING_MATRIX_ROW_ROLES]
    uq = await db.execute(
        select(User)
        .where(
            User.company_id == cid,
            User.roles.overlap(pg_array(roster_vals)),
            User.is_active.is_(True),
        )
        .order_by(User.full_name)
    )
    users = list(uq.scalars().all())
    user_ids = [str(u.id) for u in users]

    pq = await db.execute(
        select(PulseProcedure).where(PulseProcedure.company_id == cid).order_by(PulseProcedure.title)
    )
    procedures = list(pq.scalars().all())
    proc_ids = [str(p.id) for p in procedures]

    cq = await db.execute(
        select(PulseProcedureComplianceSettings).where(PulseProcedureComplianceSettings.company_id == cid)
    )
    comp_by_proc = {str(x.procedure_id): x for x in cq.scalars().all()}

    programs = [_procedure_to_program(p, comp_by_proc.get(str(p.id))) for p in procedures]

    assign_rows: list[PulseProcedureTrainingAssignment] = []
    if user_ids and proc_ids:
        aq = await db.execute(
            select(PulseProcedureTrainingAssignment).where(
                PulseProcedureTrainingAssignment.company_id == cid,
                PulseProcedureTrainingAssignment.employee_user_id.in_(user_ids),
                PulseProcedureTrainingAssignment.procedure_id.in_(proc_ids),
            )
        )
        assign_rows = list(aq.scalars().all())

    ack_map = await latest_ack_revision_map(db, cid, user_ids, proc_ids)
    proc_by_id = {str(p.id): p for p in procedures}
    revision_by_procedure = {str(p.id): int(p.content_revision or 1) for p in procedures}
    signoff_set = (
        await load_signoff_keys(db, cid, user_ids, proc_ids) if user_ids and proc_ids else set()
    )
    engagement_map = (
        await load_engagement_map(db, cid, user_ids, proc_ids, revision_by_procedure)
        if user_ids and proc_ids
        else {}
    )
    attempt_map = (
        await load_attempt_stats_for_pairs(db, cid, user_ids, proc_ids, revision_by_procedure)
        if user_ids and proc_ids
        else {}
    )
    worker_completion_map = (
        await load_latest_worker_completions_map(db, cid, user_ids, proc_ids)
        if user_ids and proc_ids
        else {}
    )

    as_of = datetime.now(timezone.utc).date()
    assignments_out: list[TrainingAssignmentOut] = []
    for a in assign_rows:
        proc = proc_by_id.get(str(a.procedure_id))
        if not proc:
            continue
        cs = comp_by_proc.get(str(a.procedure_id))
        ack = ack_map.get((str(a.employee_user_id), str(a.procedure_id)))
        marker = revision_marker_from_procedure(proc)
        sig_ok = (str(a.employee_user_id), str(a.procedure_id), marker) in signoff_set
        await enqueue_mandatory_overdue_if_needed(
            db,
            cid,
            assignment=a,
            procedure_id=str(a.procedure_id),
            employee_user_id=str(a.employee_user_id),
            compliance=cs,
            latest_ack_revision=ack,
            procedure=proc,
            as_of=as_of,
            signoff_for_current_revision=sig_ok,
        )
        assignments_out.append(
            _assignment_to_out(
                a,
                proc,
                cs,
                ack,
                str(a.employee_user_id),
                signoff_set,
                engagement_map,
                attempt_map,
                worker_completion_map,
            )
        )

    await db.commit()

    hr_map: dict[str, PulseWorkerHR] = {}
    if user_ids:
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_(user_ids)))
        for h in hq.scalars().all():
            hr_map[str(h.user_id)] = h

    users_map = {str(u.id): u for u in users}
    sup_ids_missing = {
        str(hr.supervisor_user_id)
        for hr in hr_map.values()
        if hr.supervisor_user_id and str(hr.supervisor_user_id) not in users_map
    }
    sup_name_by_id: dict[str, str] = {}
    if sup_ids_missing:
        sq = await db.execute(select(User).where(User.company_id == cid, User.id.in_(sup_ids_missing)))
        for su in sq.scalars().all():
            label = str(su.full_name or su.email or "").strip()
            if label:
                sup_name_by_id[str(su.id)] = label

    employees: list[TrainingEmployeeOut] = []
    for u in users:
        hr = hr_map.get(str(u.id))
        sup_name: Optional[str] = None
        if hr and hr.supervisor_user_id:
            sid = str(hr.supervisor_user_id)
            su = users_map.get(sid)
            if su:
                sup_name = str(su.full_name or su.email or "").strip() or None
            else:
                sup_name = sup_name_by_id.get(sid)
        employees.append(
            TrainingEmployeeOut(
                id=str(u.id),
                display_name=str(u.full_name or u.email or u.id),
                department=(hr.department or "") if hr else "",
                supervisor_name=sup_name,
            )
        )

    return TrainingMatrixOut(employees=employees, programs=programs, assignments=assignments_out)


@router.post("/assignments", response_model=list[TrainingAssignmentOut])
async def create_training_assignments(
    db: Db,
    cid: CompanyId,
    body: TrainingAssignmentCreateIn,
    actor: Annotated[User, Depends(require_training_matrix_access)],
) -> list[TrainingAssignmentOut]:
    proc = await db.get(PulseProcedure, body.procedure_id)
    if not proc or str(proc.company_id) != cid:
        raise HTTPException(status_code=404, detail="Procedure not found")

    cs = await db.get(PulseProcedureComplianceSettings, str(proc.id))
    _, _, due_w = resolve_compliance_defaults(cs)

    out: list[TrainingAssignmentOut] = []
    now = datetime.now(timezone.utc)
    today = now.date()
    ack_map = await latest_ack_revision_map(db, cid, body.employee_user_ids, [str(proc.id)])
    revision_by_procedure = {str(proc.id): int(proc.content_revision or 1)}
    signoff_set = await load_signoff_keys(db, cid, body.employee_user_ids, [str(proc.id)])
    engagement_map = await load_engagement_map(
        db, cid, body.employee_user_ids, [str(proc.id)], revision_by_procedure
    )
    attempt_map = await load_attempt_stats_for_pairs(
        db, cid, body.employee_user_ids, [str(proc.id)], revision_by_procedure
    )
    worker_completion_map = await load_latest_worker_completions_map(
        db, cid, body.employee_user_ids, [str(proc.id)]
    )

    for eid in body.employee_user_ids:
        if not await pulse_svc._user_in_company(db, cid, eid):
            raise HTTPException(status_code=400, detail=f"Unknown worker: {eid}")

        due: Optional[date] = body.due_date
        if due is None and body.use_compliance_due_window and due_w is not None:
            due = today + timedelta(days=int(due_w))

        aq = await db.execute(
            select(PulseProcedureTrainingAssignment).where(
                PulseProcedureTrainingAssignment.company_id == cid,
                PulseProcedureTrainingAssignment.employee_user_id == eid,
                PulseProcedureTrainingAssignment.procedure_id == str(proc.id),
            )
        )
        row = aq.scalar_one_or_none()
        if row is None:
            row = PulseProcedureTrainingAssignment(
                id=str(uuid4()),
                company_id=cid,
                employee_user_id=eid,
                procedure_id=str(proc.id),
                assigned_by_user_id=str(actor.id),
                assigned_date=today,
                due_date=due,
                supervisor_signoff=False,
            )
            db.add(row)
        else:
            row.assigned_by_user_id = str(actor.id)
            row.assigned_date = today
            row.due_date = due if due is not None else row.due_date
            row.updated_at = now

        await db.flush()
        ack = ack_map.get((str(eid), str(proc.id)))
        out.append(
            _assignment_to_out(
                row, proc, cs, ack, str(eid), signoff_set, engagement_map, attempt_map, worker_completion_map
            )
        )

    await db.commit()
    return out


@router.patch("/assignments/{assignment_id}", response_model=TrainingAssignmentOut)
async def patch_training_assignment_matrix_override(
    db: Db,
    cid: CompanyId,
    assignment_id: str,
    body: TrainingAssignmentMatrixOverrideIn,
    _: Annotated[User, Depends(require_company_admin)],
) -> TrainingAssignmentOut:
    row = await db.get(PulseProcedureTrainingAssignment, assignment_id)
    if row is None or str(row.company_id) != cid:
        raise HTTPException(status_code=404, detail="Assignment not found")

    proc = await db.get(PulseProcedure, str(row.procedure_id))
    if proc is None or str(proc.company_id) != cid:
        raise HTTPException(status_code=404, detail="Procedure not found")

    cs = await db.get(PulseProcedureComplianceSettings, str(proc.id))
    eid = str(row.employee_user_id)
    proc_id = str(proc.id)

    row.matrix_admin_override = body.matrix_admin_override
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()

    ack_map = await latest_ack_revision_map(db, cid, [eid], [proc_id])
    revision_by_procedure = {proc_id: int(proc.content_revision or 1)}
    signoff_set = await load_signoff_keys(db, cid, [eid], [proc_id])
    engagement_map = await load_engagement_map(db, cid, [eid], [proc_id], revision_by_procedure)
    attempt_map = await load_attempt_stats_for_pairs(db, cid, [eid], [proc_id], revision_by_procedure)
    worker_completion_map = await load_latest_worker_completions_map(db, cid, [eid], [proc_id])
    ack = ack_map.get((eid, proc_id))
    out = _assignment_to_out(row, proc, cs, ack, eid, signoff_set, engagement_map, attempt_map, worker_completion_map)
    await db.commit()
    return out


async def build_worker_training_bundle(db: AsyncSession, cid: str, user_id: str) -> WorkerTrainingOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    hr = await db.get(PulseWorkerHR, user_id)
    prof_row = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.company_id == cid,
            PulseWorkerProfile.user_id == user_id,
        ).limit(1)
    )
    prof = prof_row.scalars().first()
    sched: dict[str, Any] = dict(prof.scheduling or {}) if prof else {}
    emp = employment_type_from_scheduling(sched)
    roster_shift: Optional[str] = None
    if hr and hr.shift and str(hr.shift).strip():
        roster_shift = str(hr.shift).strip()
    else:
        rs = sched.get("shift")
        if isinstance(rs, str) and rs.strip():
            roster_shift = rs.strip()
    worker_band = matrix_shift_band_from_roster_shift(roster_shift)

    pq = await db.execute(select(PulseProcedure).where(PulseProcedure.company_id == cid).order_by(PulseProcedure.title))
    procedures = list(pq.scalars().all())
    procedures = [
        p
        for p in procedures
        if worker_should_see_procedure_for_shift_scoping(emp, worker_band, getattr(p, "search_keywords", None))
    ]
    proc_ids = [str(p.id) for p in procedures]

    cq = await db.execute(
        select(PulseProcedureComplianceSettings).where(PulseProcedureComplianceSettings.company_id == cid)
    )
    comp_by_proc = {str(x.procedure_id): x for x in cq.scalars().all()}

    programs = [_procedure_to_program(p, comp_by_proc.get(str(p.id))) for p in procedures]

    aq = await db.execute(
        select(PulseProcedureTrainingAssignment).where(
            PulseProcedureTrainingAssignment.company_id == cid,
            PulseProcedureTrainingAssignment.employee_user_id == user_id,
        )
    )
    assign_rows = list(aq.scalars().all())

    ack_map = await latest_ack_revision_map(db, cid, [user_id], proc_ids)
    proc_by_id = {str(p.id): p for p in procedures}
    revision_by_procedure = {str(p.id): int(p.content_revision or 1) for p in procedures}
    signoff_set = (
        await load_signoff_keys(db, cid, [user_id], proc_ids) if proc_ids else set()
    )
    engagement_map = (
        await load_engagement_map(db, cid, [user_id], proc_ids, revision_by_procedure)
        if proc_ids
        else {}
    )
    attempt_map = (
        await load_attempt_stats_for_pairs(db, cid, [user_id], proc_ids, revision_by_procedure)
        if proc_ids
        else {}
    )
    worker_completion_map = (
        await load_latest_worker_completions_map(db, cid, [user_id], proc_ids) if proc_ids else {}
    )

    assignments_out: list[TrainingAssignmentOut] = []
    as_of = datetime.now(timezone.utc).date()
    for a in assign_rows:
        proc = proc_by_id.get(str(a.procedure_id))
        if not proc:
            continue
        cs = comp_by_proc.get(str(a.procedure_id))
        ack = ack_map.get((str(user_id), str(a.procedure_id)))
        marker = revision_marker_from_procedure(proc)
        sig_ok = (str(user_id), str(a.procedure_id), marker) in signoff_set
        await enqueue_mandatory_overdue_if_needed(
            db,
            cid,
            assignment=a,
            procedure_id=str(a.procedure_id),
            employee_user_id=str(user_id),
            compliance=cs,
            latest_ack_revision=ack,
            procedure=proc,
            as_of=as_of,
            signoff_for_current_revision=sig_ok,
        )
        assignments_out.append(
            _assignment_to_out(
                a, proc, cs, ack, str(user_id), signoff_set, engagement_map, attempt_map, worker_completion_map
            )
        )

    ack_rows_raw: list[dict] = []
    if proc_ids:
        kq = await db.execute(
            select(PulseProcedureTrainingAcknowledgement)
            .where(
                PulseProcedureTrainingAcknowledgement.company_id == cid,
                PulseProcedureTrainingAcknowledgement.employee_user_id == user_id,
                PulseProcedureTrainingAcknowledgement.procedure_id.in_(proc_ids),
            )
            .order_by(PulseProcedureTrainingAcknowledgement.acknowledged_at.desc())
            .limit(200)
        )
        for row in kq.scalars().all():
            ack_rows_raw.append(
                {
                    "procedure_id": str(row.procedure_id),
                    "revision_number": int(row.revision_number),
                    "acknowledged_at": row.acknowledged_at.isoformat(),
                }
            )

    await db.commit()
    return WorkerTrainingOut(
        programs=programs,
        assignments=assignments_out,
        acknowledgement_summary=ack_rows_raw,
        employment_type=emp,
        matrix_shift_band=worker_band,
    )
