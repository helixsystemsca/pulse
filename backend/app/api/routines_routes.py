"""Standards (Routines) API — routine templates and execution runs."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.models.domain import User, Zone
from app.models.pulse_models import (
    PulseRoutine,
    PulseRoutineItem,
    PulseRoutineItemRun,
    PulseRoutineRun,
    PulseRoutineRunStatus,
)
from app.schemas.routines import (
    RoutineCreateIn,
    RoutineDetailOut,
    RoutineItemOut,
    RoutinePatchIn,
    RoutineOut,
    RoutineItemRunOut,
    RoutineRunCreateIn,
    RoutineRunDetailOut,
    RoutineRunOut,
)

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
        created_items.append(
            PulseRoutineItem(
                company_id=cid,
                routine_id=str(row.id),
                label=it.label.strip(),
                position=int(it.position if it.position is not None else idx),
                required=bool(it.required),
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

    if "items" in data and data["items"] is not None:
        # Replace item list (simple MVP semantics).
        await db.execute(
            delete(PulseRoutineItem).where(
                PulseRoutineItem.company_id == cid, PulseRoutineItem.routine_id == routine_id
            )
        )
        now = datetime.now(timezone.utc)
        items_sorted = sorted(list(data["items"] or []), key=lambda x: (x.get("position", 0), (x.get("label") or "").strip().lower()))
        new_items: list[PulseRoutineItem] = []
        for idx, it in enumerate(items_sorted):
            new_items.append(
                PulseRoutineItem(
                    company_id=cid,
                    routine_id=routine_id,
                    label=str(it.get("label") or "").strip(),
                    position=int(it.get("position", idx)),
                    required=bool(it.get("required", True)),
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
    return RoutineRunDetailOut(**base, items=[RoutineItemRunOut.model_validate(i) for i in items])


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

