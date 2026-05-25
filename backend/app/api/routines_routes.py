"""Standards (Routines) API — routine templates and execution runs."""

from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.models.domain import User, Zone
from app.models.pulse_models import (
    PulseProcedure,
    PulseRoutine,
    PulseRoutineItem,
    PulseRoutineItemRun,
    PulseRoutineRun,
    PulseRoutineRunStatus,
    PulseRoutineAssignment,
    PulseRoutineItemAssignment,
    PulseRoutineAssignmentExtra,
    PulseRoutineAssignmentHandover,
)
from app.schemas.routines import (
    RoutineCreateIn,
    RoutineDetailOut,
    RoutineItemOut,
    RoutinePatchIn,
    RoutineOut,
    RoutineItemRunOut,
    RoutineAssignmentCreateIn,
    RoutineAssignmentOut,
    RoutineAssignmentDetailOut,
    RoutineRunCreateIn,
    RoutineRunDetailOut,
    RoutineRunOut,
    AssignmentHandoverCreateIn,
    AssignmentHandoverPatchIn,
    AssignmentHandoverOut,
    AssignmentHandoverSummaryOut,
)
from app.services.assignment_handover import (
    HANDOVER_NOTE_TYPES,
    OPEN_HANDOVER_NOTE_TYPES,
    display_name_for_user,
    handover_defaults_resolved,
    handover_out_dict,
    resolve_handover_metadata,
    user_involved_in_assignment,
    user_is_supervisor_for_handovers,
    utc_now,
)
from app.services.routine_shift_band import filter_items_for_shift_band, resolve_shift_band_for_shift_id

router = APIRouter(prefix="/routines", tags=["routines"])


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company context required")
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _routine_to_out(r: PulseRoutine) -> RoutineOut:
    return RoutineOut.model_validate(r)


def _item_to_out(i: PulseRoutineItem) -> RoutineItemOut:
    return RoutineItemOut.model_validate(i)


async def _resolve_routine_item_label_and_procedure(
    db: AsyncSession,
    cid: str,
    label: str,
    procedure_id: Optional[str],
) -> tuple[str, Optional[str]]:
    """Validate optional procedure belongs to tenant; default checklist label from procedure title."""
    lab = (label or "").strip()
    pid = (procedure_id or "").strip() or None
    if pid:
        proc = await db.get(PulseProcedure, pid)
        if not proc or str(proc.company_id) != cid:
            raise HTTPException(status_code=400, detail="Unknown procedure")
        title = (proc.title or "").strip()
        final = lab or title or "Procedure"
        return final, pid
    if not lab:
        raise HTTPException(status_code=400, detail="Each checklist line needs a procedure or label")
    return lab, None


@router.get("", response_model=list[RoutineOut])
async def list_routines(
    db: Db,
    cid: CompanyId,
    zone_id: Optional[str] = Query(None),
) -> list[RoutineOut]:
    conds = [PulseRoutine.company_id == cid]
    if zone_id:
        conds.append(PulseRoutine.zone_id == zone_id)
    q = await db.execute(select(PulseRoutine).where(and_(*conds)).order_by(PulseRoutine.updated_at.desc()))
    return [_routine_to_out(r) for r in q.scalars().all()]


@router.post("", response_model=RoutineDetailOut, status_code=status.HTTP_201_CREATED)
async def create_routine(
    body: RoutineCreateIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> RoutineDetailOut:
    zid = body.zone_id
    if zid:
        zq = await db.execute(select(Zone.id).where(Zone.id == zid, Zone.company_id == cid))
        if zq.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unknown zone")
    now = datetime.now(timezone.utc)
    row = PulseRoutine(
        company_id=cid,
        name=body.name.strip(),
        zone_id=zid,
        created_by_user_id=str(user.id),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()

    # Items: normalize positions to stable order.
    items_sorted = sorted(list(body.items or []), key=lambda x: (x.position, x.label.strip().lower()))
    created_items: list[PulseRoutineItem] = []
    for idx, it in enumerate(items_sorted):
        sb = it.shift_band
        sb_s = str(sb).strip().lower() if sb else None
        lab, pid = await _resolve_routine_item_label_and_procedure(db, cid, it.label, it.procedure_id)
        created_items.append(
            PulseRoutineItem(
                company_id=cid,
                routine_id=str(row.id),
                label=lab,
                procedure_id=pid,
                position=int(it.position if it.position is not None else idx),
                required=bool(it.required),
                shift_band=sb_s,
                created_at=now,
                updated_at=now,
            )
        )
    if created_items:
        db.add_all(created_items)
    await db.commit()
    await db.refresh(row)

    # Reload items to get IDs.
    iq = await db.execute(
        select(PulseRoutineItem)
        .where(PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == str(row.id))
        .order_by(PulseRoutineItem.position.asc(), PulseRoutineItem.created_at.asc())
    )
    items = iq.scalars().all()
    base = RoutineOut.model_validate(row).model_dump()
    return RoutineDetailOut(**base, items=[_item_to_out(i) for i in items])


@router.get("/{routine_id}", response_model=RoutineDetailOut)
async def get_routine(db: Db, cid: CompanyId, routine_id: str) -> RoutineDetailOut:
    r = await db.get(PulseRoutine, routine_id)
    if not r or r.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    iq = await db.execute(
        select(PulseRoutineItem)
        .where(PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == routine_id)
        .order_by(PulseRoutineItem.position.asc(), PulseRoutineItem.created_at.asc())
    )
    items = iq.scalars().all()
    base = RoutineOut.model_validate(r).model_dump()
    return RoutineDetailOut(**base, items=[_item_to_out(i) for i in items])


@router.patch("/{routine_id}", response_model=RoutineDetailOut)
async def patch_routine(
    routine_id: str,
    body: RoutinePatchIn,
    db: Db,
    cid: CompanyId,
) -> RoutineDetailOut:
    r = await db.get(PulseRoutine, routine_id)
    if not r or r.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        r.name = str(data["name"]).strip()
    if "zone_id" in data:
        r.zone_id = data["zone_id"] or None
    r.updated_at = datetime.now(timezone.utc)

    if body.items is not None:
        # Replace item list (simple MVP semantics).
        await db.execute(
            delete(PulseRoutineItem).where(
                PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == routine_id
            )
        )
        now = datetime.now(timezone.utc)
        items_sorted = sorted(list(body.items), key=lambda x: (x.position, x.label.strip().lower()))
        new_items: list[PulseRoutineItem] = []
        for idx, it in enumerate(items_sorted):
            sb = it.shift_band
            sb_s = str(sb).strip().lower() if sb else None
            if sb_s and sb_s not in ("day", "afternoon", "night"):
                sb_s = None
            lab, pid = await _resolve_routine_item_label_and_procedure(db, cid, it.label, it.procedure_id)
            new_items.append(
                PulseRoutineItem(
                    company_id=cid,
                    routine_id=routine_id,
                    label=lab,
                    procedure_id=pid,
                    position=int(it.position if it.position is not None else idx),
                    required=bool(it.required),
                    shift_band=sb_s,
                    created_at=now,
                    updated_at=now,
                )
            )
        if new_items:
            db.add_all(new_items)

    await db.commit()
    await db.refresh(r)
    return await get_routine(db, cid, routine_id)


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(db: Db, cid: CompanyId, routine_id: str) -> None:
    r = await db.get(PulseRoutine, routine_id)
    if not r or r.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseRoutine).where(PulseRoutine.id == routine_id))
    await db.commit()


@router.post("/runs", response_model=RoutineRunDetailOut, status_code=status.HTTP_201_CREATED)
async def create_routine_run(
    body: RoutineRunCreateIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> RoutineRunDetailOut:
    # Validate routine exists in tenant.
    routine = await db.get(PulseRoutine, body.routine_id)
    if not routine or routine.company_id != cid:
        raise HTTPException(status_code=400, detail="Unknown routine")

    # Load template items to validate routine_item_id membership.
    iq = await db.execute(
        select(PulseRoutineItem.id)
        .where(PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == body.routine_id)
    )
    valid_item_ids = {str(x) for x in iq.scalars().all()}
    for it in body.items:
        if str(it.routine_item_id) not in valid_item_ids:
            raise HTTPException(status_code=400, detail="Unknown routine_item_id for this routine")

    now = datetime.now(timezone.utc)
    run = PulseRoutineRun(
        company_id=cid,
        routine_id=body.routine_id,
        user_id=str(user.id),
        shift_id=body.shift_id,
        started_at=now,
        completed_at=now,
        status=PulseRoutineRunStatus.completed,
        routine_assignment_id=body.routine_assignment_id,
    )
    db.add(run)
    await db.flush()

    item_rows: list[PulseRoutineItemRun] = []
    for it in body.items:
        item_rows.append(
            PulseRoutineItemRun(
                company_id=cid,
                routine_run_id=str(run.id),
                routine_item_id=it.routine_item_id,
                completed=bool(it.completed),
                note=(it.note or "").strip() or None,
                completed_by_user_id=str(user.id) if bool(it.completed) else None,
            )
        )
    if item_rows:
        db.add_all(item_rows)
    await db.commit()
    await db.refresh(run)

    # Return detail payload.
    oq = await db.execute(
        select(PulseRoutineItemRun).where(
            PulseRoutineItemRun.company_id == cid, PulseRoutineItemRun.routine_run_id == str(run.id)
        )
    )
    items = oq.scalars().all()
    base = RoutineRunOut.model_validate(run).model_dump()
    extras_out: list = []
    if body.routine_assignment_id:
        # Update extras completion state on the assignment for audit.
        ex_ids = [ex.id for ex in body.extras]
        if ex_ids:
            exq = await db.execute(
                select(PulseRoutineAssignmentExtra).where(
                    PulseRoutineAssignmentExtra.company_id == cid,
                    PulseRoutineAssignmentExtra.routine_assignment_id == body.routine_assignment_id,
                    PulseRoutineAssignmentExtra.id.in_(ex_ids),
                )
            )
            rows = exq.scalars().all()
            by_id = {str(x.id): x for x in rows}
            for ex in body.extras:
                row = by_id.get(str(ex.id))
                if not row:
                    continue
                row.completed = bool(ex.completed)
                row.note = (ex.note or "").strip() or None
                if row.completed:
                    row.completed_by_user_id = str(user.id)
                    row.completed_at = now
            await db.commit()
            # Reload for response
            exq2 = await db.execute(
                select(PulseRoutineAssignmentExtra).where(
                    PulseRoutineAssignmentExtra.company_id == cid,
                    PulseRoutineAssignmentExtra.routine_assignment_id == body.routine_assignment_id,
                )
            )
            extras_out = exq2.scalars().all()
    return RoutineRunDetailOut(
        **base,
        items=[RoutineItemRunOut.model_validate(i) for i in items],
        extras=[
            {
                "id": str(e.id),
                "label": e.label,
                "assigned_to_user_id": str(e.assigned_to_user_id) if e.assigned_to_user_id else None,
                "completed": bool(e.completed),
                "completed_by_user_id": str(e.completed_by_user_id) if e.completed_by_user_id else None,
                "completed_at": e.completed_at,
                "note": e.note,
            }
            for e in extras_out
        ],
    )


@router.post("/assignments", response_model=RoutineAssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_routine_assignment(
    body: RoutineAssignmentCreateIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> RoutineAssignmentOut:
    # Validate routine exists.
    routine = await db.get(PulseRoutine, body.routine_id)
    if not routine or routine.company_id != cid:
        raise HTTPException(status_code=400, detail="Unknown routine")

    # Validate primary user belongs to company.
    uq = await db.execute(select(User.id).where(User.id == body.primary_user_id, User.company_id == cid))
    if uq.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Unknown primary_user_id")

    shift_id: Optional[str] = None
    if body.shift_id:
        try:
            shift_id = str(UUID(str(body.shift_id).strip()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid shift_id (expected UUID)") from None

    # Validate routine item ids belong to this routine.
    iq = await db.execute(
        select(PulseRoutineItem.id).where(
            PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == body.routine_id
        )
    )
    valid_item_ids = {str(x) for x in iq.scalars().all()}
    for ia in body.item_assignments:
        if str(ia.routine_item_id) not in valid_item_ids:
            raise HTTPException(status_code=400, detail="Unknown routine_item_id for this routine")

    now = datetime.now(timezone.utc)
    assigned_date: Optional[date] = None
    if body.date:
        try:
            assigned_date = date.fromisoformat(str(body.date))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date (expected YYYY-MM-DD)") from None

    a = PulseRoutineAssignment(
        company_id=cid,
        routine_id=body.routine_id,
        shift_id=shift_id,
        date=assigned_date,
        primary_user_id=body.primary_user_id,
        assigned_by_user_id=str(user.id),
        created_at=now,
    )
    db.add(a)
    await db.flush()

    # Item assignments
    if body.item_assignments:
        rows = [
            PulseRoutineItemAssignment(
                company_id=cid,
                routine_assignment_id=str(a.id),
                routine_item_id=ia.routine_item_id,
                assigned_to_user_id=ia.assigned_to_user_id,
                assigned_by_user_id=str(user.id),
                reason=(ia.reason or "").strip() or None,
                created_at=now,
            )
            for ia in body.item_assignments
        ]
        db.add_all(rows)

    # Extras
    if body.extras:
        ex_rows = [
            PulseRoutineAssignmentExtra(
                company_id=cid,
                routine_assignment_id=str(a.id),
                label=str(ex.label).strip(),
                assigned_to_user_id=ex.assigned_to_user_id,
                created_by_user_id=str(user.id),
                created_at=now,
                completed=False,
                note=None,
            )
            for ex in body.extras
            if str(ex.label).strip()
        ]
        if ex_rows:
            db.add_all(ex_rows)

    await db.commit()
    await db.refresh(a)
    return RoutineAssignmentOut(
        id=str(a.id),
        company_id=str(a.company_id),
        routine_id=str(a.routine_id),
        shift_id=str(a.shift_id) if a.shift_id else None,
        date=str(a.date) if a.date else None,
        primary_user_id=str(a.primary_user_id),
        assigned_by_user_id=str(a.assigned_by_user_id) if a.assigned_by_user_id else None,
        created_at=a.created_at,
    )


async def _routine_assignment_detail_out(
    db: AsyncSession,
    cid: str,
    a: PulseRoutineAssignment,
) -> Optional[RoutineAssignmentDetailOut]:
    routine = await db.get(PulseRoutine, a.routine_id)
    if not routine or routine.company_id != cid:
        return None
    aid = str(a.id)
    iq = await db.execute(
        select(PulseRoutineItem)
        .where(PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == str(routine.id))
        .order_by(PulseRoutineItem.position.asc(), PulseRoutineItem.created_at.asc())
    )
    items = iq.scalars().all()
    band = await resolve_shift_band_for_shift_id(db, cid, str(a.shift_id)) if a.shift_id else None
    items = filter_items_for_shift_band(items, band)
    routine_out = RoutineDetailOut(
        **RoutineOut.model_validate(routine).model_dump(),
        items=[RoutineItemOut.model_validate(i) for i in items],
    )
    ias = (
        await db.execute(
            select(PulseRoutineItemAssignment).where(
                PulseRoutineItemAssignment.company_id == cid,
                PulseRoutineItemAssignment.routine_assignment_id == aid,
            )
        )
    ).scalars().all()
    extras = (
        await db.execute(
            select(PulseRoutineAssignmentExtra).where(
                PulseRoutineAssignmentExtra.company_id == cid,
                PulseRoutineAssignmentExtra.routine_assignment_id == aid,
            )
        )
    ).scalars().all()
    return RoutineAssignmentDetailOut(
        id=aid,
        company_id=str(a.company_id),
        routine_id=str(a.routine_id),
        shift_id=str(a.shift_id) if a.shift_id else None,
        date=str(a.date) if a.date else None,
        primary_user_id=str(a.primary_user_id),
        assigned_by_user_id=str(a.assigned_by_user_id) if a.assigned_by_user_id else None,
        created_at=a.created_at,
        routine=routine_out,
        item_assignments=[
            {
                "routine_item_id": str(x.routine_item_id) if x.routine_item_id else None,
                "assigned_to_user_id": str(x.assigned_to_user_id),
                "reason": x.reason,
            }
            for x in ias
        ],
        extras=[
            {
                "id": str(e.id),
                "label": e.label,
                "assigned_to_user_id": str(e.assigned_to_user_id) if e.assigned_to_user_id else None,
                "completed": bool(e.completed),
                "completed_by_user_id": str(e.completed_by_user_id) if e.completed_by_user_id else None,
                "completed_at": e.completed_at,
                "note": e.note,
            }
            for e in extras
        ],
    )


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine_assignment(
    assignment_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> None:
    """Remove a saved routine assignment (checklist lines and extras cascade)."""
    del user  # tenant gate only
    try:
        aid = str(UUID(str(assignment_id).strip()))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assignment_id") from None

    a = await db.get(PulseRoutineAssignment, aid)
    if not a or str(a.company_id) != cid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    await db.delete(a)
    await db.commit()


@router.get("/assignments/day", response_model=list[RoutineAssignmentDetailOut])
async def list_routine_assignments_for_day(
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    assignment_day: str = Query(
        ...,
        alias="date",
        description="Calendar date (YYYY-MM-DD)",
    ),
) -> list[RoutineAssignmentDetailOut]:
    """All routine assignments on a calendar day — for ops dashboard / supervisor handoff view."""
    try:
        assigned_date = date.fromisoformat(str(assignment_day).strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date (expected YYYY-MM-DD)") from None

    q = await db.execute(
        select(PulseRoutineAssignment)
        .where(
            PulseRoutineAssignment.company_id == cid,
            PulseRoutineAssignment.date == assigned_date,
        )
        .order_by(PulseRoutineAssignment.created_at.desc())
        .limit(500)
    )
    rows = q.scalars().all()
    out: list[RoutineAssignmentDetailOut] = []
    for a in rows:
        detail = await _routine_assignment_detail_out(db, cid, a)
        if detail:
            out.append(detail)
    return out


@router.get("/assignments/my", response_model=list[RoutineAssignmentDetailOut])
async def list_my_routine_assignments(
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    shift_id: Optional[str] = Query(None),
) -> list[RoutineAssignmentDetailOut]:
    """
    Returns assignments relevant to the current user for execution:
    - primary routines assigned to them
    - routines where they have delegated items
    - routines where they have extra tasks
    """
    uid = str(user.id)
    conds = [PulseRoutineAssignment.company_id == cid]
    if shift_id:
        conds.append(PulseRoutineAssignment.shift_id == shift_id)

    # Gather assignment IDs where user is involved.
    base_stmt = select(PulseRoutineAssignment).where(and_(*conds))
    q = await db.execute(base_stmt.order_by(PulseRoutineAssignment.created_at.desc()).limit(200))
    candidates = q.scalars().all()
    if not candidates:
        return []

    candidate_ids = [str(a.id) for a in candidates]
    involved_ids: set[str] = set()

    for a in candidates:
        if str(a.primary_user_id) == uid:
            involved_ids.add(str(a.id))

    iaq = await db.execute(
        select(PulseRoutineItemAssignment.routine_assignment_id).where(
            PulseRoutineItemAssignment.company_id == cid,
            PulseRoutineItemAssignment.routine_assignment_id.in_(candidate_ids),
            PulseRoutineItemAssignment.assigned_to_user_id == uid,
        )
    )
    involved_ids.update([str(x) for x in iaq.scalars().all()])

    exq = await db.execute(
        select(PulseRoutineAssignmentExtra.routine_assignment_id).where(
            PulseRoutineAssignmentExtra.company_id == cid,
            PulseRoutineAssignmentExtra.routine_assignment_id.in_(candidate_ids),
            PulseRoutineAssignmentExtra.assigned_to_user_id == uid,
        )
    )
    involved_ids.update([str(x) for x in exq.scalars().all()])

    out: list[RoutineAssignmentDetailOut] = []
    for a in candidates:
        if str(a.id) not in involved_ids:
            continue
        detail = await _routine_assignment_detail_out(db, cid, a)
        if detail:
            out.append(detail)
    return out


@router.get("/runs", response_model=list[RoutineRunOut])
async def list_routine_runs(
    db: Db,
    cid: CompanyId,
    routine_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    has_missed_items: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> list[RoutineRunOut]:
    conds = [PulseRoutineRun.company_id == cid, PulseRoutineRun.status == PulseRoutineRunStatus.completed]
    if routine_id:
        conds.append(PulseRoutineRun.routine_id == routine_id)
    if user_id:
        conds.append(PulseRoutineRun.user_id == user_id)
    if from_ts is not None:
        conds.append(PulseRoutineRun.completed_at.isnot(None))
        conds.append(PulseRoutineRun.completed_at >= from_ts)
    if to_ts is not None:
        conds.append(PulseRoutineRun.completed_at.isnot(None))
        conds.append(PulseRoutineRun.completed_at <= to_ts)

    stmt = select(PulseRoutineRun).where(and_(*conds))
    if has_missed_items is True:
        # Exists an incomplete item row.
        subq = (
            select(func.count())
            .select_from(PulseRoutineItemRun)
            .where(
                PulseRoutineItemRun.company_id == cid,
                PulseRoutineItemRun.routine_run_id == PulseRoutineRun.id,
                PulseRoutineItemRun.completed.is_(False),
            )
            .correlate(PulseRoutineRun)
            .scalar_subquery()
        )
        stmt = stmt.where(subq > 0)
    stmt = stmt.order_by(PulseRoutineRun.completed_at.desc()).limit(limit)
    q = await db.execute(stmt)
    return [RoutineRunOut.model_validate(r) for r in q.scalars().all()]


@router.get("/runs/{run_id}", response_model=RoutineRunDetailOut)
async def get_routine_run_detail(db: Db, cid: CompanyId, run_id: str) -> RoutineRunDetailOut:
    run = await db.get(PulseRoutineRun, run_id)
    if not run or run.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    oq = await db.execute(
        select(PulseRoutineItemRun).where(
            PulseRoutineItemRun.company_id == cid, PulseRoutineItemRun.routine_run_id == str(run.id)
        )
    )
    items = oq.scalars().all()
    extras_out: list = []
    if run.routine_assignment_id:
        exq = await db.execute(
            select(PulseRoutineAssignmentExtra).where(
                PulseRoutineAssignmentExtra.company_id == cid,
                PulseRoutineAssignmentExtra.routine_assignment_id == str(run.routine_assignment_id),
            )
        )
        extras_out = exq.scalars().all()
    base = RoutineRunOut.model_validate(run).model_dump()
    return RoutineRunDetailOut(
        **base,
        items=[RoutineItemRunOut.model_validate(i) for i in items],
        extras=[
            {
                "id": str(e.id),
                "label": e.label,
                "assigned_to_user_id": str(e.assigned_to_user_id) if e.assigned_to_user_id else None,
                "completed": bool(e.completed),
                "completed_by_user_id": str(e.completed_by_user_id) if e.completed_by_user_id else None,
                "completed_at": e.completed_at,
                "note": e.note,
            }
            for e in extras_out
        ],
    )


async def _get_assignment_or_404(
    db: AsyncSession,
    cid: str,
    assignment_id: str,
) -> PulseRoutineAssignment:
    try:
        aid = str(UUID(str(assignment_id).strip()))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assignment_id") from None
    a = await db.get(PulseRoutineAssignment, aid)
    if not a or str(a.company_id) != cid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return a


async def _handover_row_to_out(db: AsyncSession, row: PulseRoutineAssignmentHandover) -> AssignmentHandoverOut:
    author_display = await display_name_for_user(db, str(row.author_user_id))
    resolved_by_display = await display_name_for_user(db, str(row.resolved_by_user_id) if row.resolved_by_user_id else None)
    edited_by_display = await display_name_for_user(db, str(row.last_edited_by_user_id) if row.last_edited_by_user_id else None)
    return AssignmentHandoverOut.model_validate(
        handover_out_dict(
            row,
            author_display=author_display,
            resolved_by_display=resolved_by_display,
            edited_by_display=edited_by_display,
        )
    )


@router.get("/assignments/day/handovers/summary", response_model=list[AssignmentHandoverSummaryOut])
async def list_assignment_handover_summaries(
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    assignment_day: str = Query(..., alias="date", description="Calendar date (YYYY-MM-DD)"),
) -> list[AssignmentHandoverSummaryOut]:
    """Per-assignment handover counts for ops widgets."""
    del user
    try:
        assigned_date = date.fromisoformat(str(assignment_day).strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date (expected YYYY-MM-DD)") from None

    aq = await db.execute(
        select(PulseRoutineAssignment.id).where(
            PulseRoutineAssignment.company_id == cid,
            PulseRoutineAssignment.date == assigned_date,
        )
    )
    assignment_ids = [str(x) for x in aq.scalars().all()]
    if not assignment_ids:
        return []

    open_flag = case(
        (
            and_(
                PulseRoutineAssignmentHandover.is_resolved.is_(False),
                PulseRoutineAssignmentHandover.note_type.in_(tuple(OPEN_HANDOVER_NOTE_TYPES)),
            ),
            1,
        ),
        else_=0,
    )
    q = await db.execute(
        select(
            PulseRoutineAssignmentHandover.routine_assignment_id,
            func.count(PulseRoutineAssignmentHandover.id).label("total_count"),
            func.sum(open_flag).label("open_count"),
        )
        .where(
            PulseRoutineAssignmentHandover.company_id == cid,
            PulseRoutineAssignmentHandover.routine_assignment_id.in_(assignment_ids),
        )
        .group_by(PulseRoutineAssignmentHandover.routine_assignment_id)
    )
    return [
        AssignmentHandoverSummaryOut(
            assignment_id=str(row.routine_assignment_id),
            total_count=int(row.total_count or 0),
            open_count=int(row.open_count or 0),
        )
        for row in q.all()
    ]


@router.get("/assignments/{assignment_id}/handovers", response_model=list[AssignmentHandoverOut])
async def list_assignment_handovers(
    assignment_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> list[AssignmentHandoverOut]:
    a = await _get_assignment_or_404(db, cid, assignment_id)
    uid = str(user.id)
    if not user_is_supervisor_for_handovers(user):
        if not await user_involved_in_assignment(db, cid, a, uid):
            raise HTTPException(status_code=403, detail="Not authorized for this assignment")

    q = await db.execute(
        select(PulseRoutineAssignmentHandover)
        .where(
            PulseRoutineAssignmentHandover.company_id == cid,
            PulseRoutineAssignmentHandover.routine_assignment_id == str(a.id),
        )
        .order_by(PulseRoutineAssignmentHandover.created_at.desc())
        .limit(200)
    )
    rows = q.scalars().all()
    out: list[AssignmentHandoverOut] = []
    for row in rows:
        out.append(await _handover_row_to_out(db, row))
    return out


@router.post(
    "/assignments/{assignment_id}/handovers",
    response_model=AssignmentHandoverOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment_handover(
    assignment_id: str,
    body: AssignmentHandoverCreateIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> AssignmentHandoverOut:
    a = await _get_assignment_or_404(db, cid, assignment_id)
    uid = str(user.id)
    if not user_is_supervisor_for_handovers(user):
        if not await user_involved_in_assignment(db, cid, a, uid):
            raise HTTPException(status_code=403, detail="Workers may only add handovers for their assignments")

    note_type = str(body.note_type).strip()
    if note_type not in HANDOVER_NOTE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid note_type")

    meta = await resolve_handover_metadata(
        db,
        cid,
        a,
        employee_name_override=(body.employee_name or "").strip() or None,
    )
    now = utc_now()
    resolved = handover_defaults_resolved(note_type)
    row = PulseRoutineAssignmentHandover(
        company_id=cid,
        routine_assignment_id=str(a.id),
        author_user_id=uid,
        employee_user_id=meta["employee_user_id"],
        employee_name=meta["employee_name"],
        department_slug=meta["department_slug"],
        operational_area=(body.operational_area or "").strip() or meta["operational_area"],
        shift_id=meta["shift_id"],
        shift_label=(body.shift_label or "").strip() or meta["shift_label"],
        assignment_date=meta["assignment_date"],
        note_type=note_type,
        content=body.content.strip(),
        is_resolved=resolved,
        resolved_at=now if resolved else None,
        resolved_by_user_id=uid if resolved else None,
        last_edited_by_user_id=uid,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return await _handover_row_to_out(db, row)


@router.patch("/assignments/{assignment_id}/handovers/{handover_id}", response_model=AssignmentHandoverOut)
async def patch_assignment_handover(
    assignment_id: str,
    handover_id: str,
    body: AssignmentHandoverPatchIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> AssignmentHandoverOut:
    a = await _get_assignment_or_404(db, cid, assignment_id)
    row = await db.get(PulseRoutineAssignmentHandover, handover_id)
    if not row or str(row.company_id) != cid or str(row.routine_assignment_id) != str(a.id):
        raise HTTPException(status_code=404, detail="Handover not found")

    uid = str(user.id)
    is_super = user_is_supervisor_for_handovers(user)
    if not is_super and str(row.author_user_id) != uid:
        raise HTTPException(status_code=403, detail="Only the author or a supervisor may edit this handover")
    if not is_super and not await user_involved_in_assignment(db, cid, a, uid):
        raise HTTPException(status_code=403, detail="Not authorized for this assignment")

    if body.content is not None:
        row.content = body.content.strip()
    if body.note_type is not None:
        nt = str(body.note_type).strip()
        if nt not in HANDOVER_NOTE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid note_type")
        row.note_type = nt
        if handover_defaults_resolved(nt):
            row.is_resolved = True
            row.resolved_at = row.resolved_at or utc_now()
            row.resolved_by_user_id = row.resolved_by_user_id or uid
        elif not is_super:
            row.is_resolved = False
            row.resolved_at = None
            row.resolved_by_user_id = None

    row.last_edited_by_user_id = uid
    row.updated_at = utc_now()
    await db.commit()
    await db.refresh(row)
    return await _handover_row_to_out(db, row)


@router.post(
    "/assignments/{assignment_id}/handovers/{handover_id}/resolve",
    response_model=AssignmentHandoverOut,
)
async def resolve_assignment_handover(
    assignment_id: str,
    handover_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> AssignmentHandoverOut:
    if not user_is_supervisor_for_handovers(user):
        raise HTTPException(status_code=403, detail="Supervisor access required")

    a = await _get_assignment_or_404(db, cid, assignment_id)
    row = await db.get(PulseRoutineAssignmentHandover, handover_id)
    if not row or str(row.company_id) != cid or str(row.routine_assignment_id) != str(a.id):
        raise HTTPException(status_code=404, detail="Handover not found")

    now = utc_now()
    row.is_resolved = True
    row.resolved_at = now
    row.resolved_by_user_id = str(user.id)
    row.last_edited_by_user_id = str(user.id)
    row.updated_at = now
    await db.commit()
    await db.refresh(row)
    return await _handover_row_to_out(db, row)

