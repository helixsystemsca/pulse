"""Procedure training matrix and bulk assignments (`/api/v1/training/*`)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal, Optional, cast
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_manager_or_above, require_tenant_user
from app.models.domain import User, UserRole
from app.models.pulse_models import (
    PulseProcedure,
    PulseProcedureComplianceSettings,
    PulseProcedureTrainingAcknowledgement,
    PulseProcedureTrainingAssignment,
    PulseWorkerHR,
)
from app.modules.pulse import service as pulse_svc
from app.schemas.maintenance_hub import normalize_procedure_steps
from app.schemas.training import (
    TrainingAssignmentCreateIn,
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
    resolve_compliance_defaults,
)

router = APIRouter(prefix="/training", tags=["training"])

Db = Annotated[AsyncSession, Depends(get_db)]

_ROSTER_ROLES = (
    UserRole.company_admin,
    UserRole.manager,
    UserRole.supervisor,
    UserRole.lead,
    UserRole.worker,
    UserRole.demo_viewer,
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
        expiry_months=None,
        due_within_days=due_w,
        active=True,
    )


def _assignment_to_out(
    row: PulseProcedureTrainingAssignment,
    proc: PulseProcedure,
    cs: PulseProcedureComplianceSettings | None,
    latest_ack: Optional[int],
) -> TrainingAssignmentOut:
    st = compute_training_assignment_status(
        assignment=row,
        procedure=proc,
        compliance=cs,
        latest_ack_revision=latest_ack,
    )
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
    )


@router.get("/matrix", response_model=TrainingMatrixOut)
async def training_matrix(
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingMatrixOut:
    roster_vals = [r.value for r in _ROSTER_ROLES]
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

    as_of = datetime.now(timezone.utc).date()
    assignments_out: list[TrainingAssignmentOut] = []
    for a in assign_rows:
        proc = proc_by_id.get(str(a.procedure_id))
        if not proc:
            continue
        cs = comp_by_proc.get(str(a.procedure_id))
        ack = ack_map.get((str(a.employee_user_id), str(a.procedure_id)))
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
        )
        assignments_out.append(_assignment_to_out(a, proc, cs, ack))

    await db.commit()

    hr_map: dict[str, PulseWorkerHR] = {}
    if user_ids:
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_(user_ids)))
        for h in hq.scalars().all():
            hr_map[str(h.user_id)] = h

    users_map = {str(u.id): u for u in users}
    employees: list[TrainingEmployeeOut] = []
    for u in users:
        hr = hr_map.get(str(u.id))
        sup_name: Optional[str] = None
        if hr and hr.supervisor_user_id:
            su = users_map.get(str(hr.supervisor_user_id))
            if su:
                sup_name = str(su.full_name or su.email or "").strip() or None
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
    actor: Annotated[User, Depends(require_manager_or_above)],
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
        out.append(_assignment_to_out(row, proc, cs, ack))

    await db.commit()
    return out


async def build_worker_training_bundle(db: AsyncSession, cid: str, user_id: str) -> WorkerTrainingOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    pq = await db.execute(select(PulseProcedure).where(PulseProcedure.company_id == cid).order_by(PulseProcedure.title))
    procedures = list(pq.scalars().all())
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

    assignments_out: list[TrainingAssignmentOut] = []
    as_of = datetime.now(timezone.utc).date()
    for a in assign_rows:
        proc = proc_by_id.get(str(a.procedure_id))
        if not proc:
            continue
        cs = comp_by_proc.get(str(a.procedure_id))
        ack = ack_map.get((str(user_id), str(a.procedure_id)))
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
        )
        assignments_out.append(_assignment_to_out(a, proc, cs, ack))

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
    return WorkerTrainingOut(programs=programs, assignments=assignments_out, acknowledgement_summary=ack_rows_raw)
