from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, ManagerUser
from app.schemas.pm import PMCompletionOut, PMScheduleCreate, PMScheduleOut, PMScheduleUpdate
from app.schemas.work_order import WorkOrderOut
from app.services.audit import write_audit
from app.services import pm_service

router = APIRouter(prefix="/pm", tags=["preventive-maintenance"])


@router.get("/schedules", response_model=list[PMScheduleOut])
async def list_schedules(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
    active_only: bool | None = Query(default=None),
) -> list[PMScheduleOut]:
    rows = await pm_service.list_schedules(db, current.company_id, active_only)
    return [PMScheduleOut.model_validate(r) for r in rows]


@router.post("/schedules", response_model=PMScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: PMScheduleCreate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> PMScheduleOut:
    try:
        pm = await pm_service.create_schedule(db, mgr.company_id, data)
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="pm_schedule.create",
            entity_type="pm_schedule",
            entity_id=pm.id,
            payload={"name": pm.name},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PMScheduleOut.model_validate(pm)


@router.get("/schedules/{schedule_id}", response_model=PMScheduleOut)
async def get_schedule(
    schedule_id: str,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> PMScheduleOut:
    pm = await pm_service.get_schedule(db, current.company_id, schedule_id)
    if pm is None:
        raise HTTPException(status_code=404, detail="Not found")
    return PMScheduleOut.model_validate(pm)


@router.patch("/schedules/{schedule_id}", response_model=PMScheduleOut)
async def update_schedule(
    schedule_id: str,
    data: PMScheduleUpdate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> PMScheduleOut:
    pm = await pm_service.get_schedule(db, mgr.company_id, schedule_id)
    if pm is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        pm = await pm_service.update_schedule(db, pm, data)
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="pm_schedule.update",
            entity_type="pm_schedule",
            entity_id=pm.id,
            payload=data.model_dump(exclude_unset=True),
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PMScheduleOut.model_validate(pm)


@router.post("/generate-due", response_model=list[WorkOrderOut])
async def generate_due(
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> list[WorkOrderOut]:
    created = await pm_service.generate_due_work_orders(db, mgr.company_id, mgr.id)
    for wo in created:
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="pm.generate_work_order",
            entity_type="work_order",
            entity_id=wo.id,
            payload={"pm_schedule_id": wo.source_pm_schedule_id},
        )
    await db.commit()
    return [WorkOrderOut.model_validate(w) for w in created]


@router.get("/completions", response_model=list[PMCompletionOut])
async def list_completions(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
    schedule_id: str | None = Query(default=None),
) -> list[PMCompletionOut]:
    rows = await pm_service.list_completions(db, current.company_id, schedule_id)
    return [PMCompletionOut.model_validate(r) for r in rows]
