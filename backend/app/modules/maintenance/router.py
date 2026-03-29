"""Maintenance schedules, confirmations, and persisted logs."""

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import MaintenanceLog, MaintenanceSchedule, User
from app.modules.maintenance import MODULE_KEY
from app.modules.maintenance.schemas import MaintenanceConfirm, ScheduleCreate

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/schedules")
async def list_schedules(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    q = await db.execute(select(MaintenanceSchedule).where(MaintenanceSchedule.company_id == user.company_id))
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "tool_id": r.tool_id,
            "interval_days": r.interval_days,
            "usage_units_threshold": r.usage_units_threshold,
            "next_due_at": r.next_due_at,
        }
        for r in rows
    ]


@router.post("/schedules")
async def create_schedule(
    body: ScheduleCreate,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    row = MaintenanceSchedule(
        company_id=user.company_id,
        tool_id=body.tool_id,
        name=body.name,
        interval_days=body.interval_days,
        usage_units_threshold=body.usage_units_threshold,
        next_due_at=body.next_due_at,
    )
    db.add(row)
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="maintenance.schedule_created",
            company_id=user.company_id,
            entity_id=row.id,
            metadata={"schedule_id": row.id, "name": row.name, "tool_id": row.tool_id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"id": row.id}


@router.post("/schedules/{schedule_id}/infer")
async def infer_due(
    schedule_id: str,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Stub for inference-based maintenance detection (vibration hours, usage counters, etc.)."""
    q = await db.execute(
        select(MaintenanceSchedule).where(
            MaintenanceSchedule.id == schedule_id, MaintenanceSchedule.company_id == user.company_id
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await event_engine.publish(
        DomainEvent(
            event_type="maintenance.inference_due",
            company_id=user.company_id,
            entity_id=row.id,
            metadata={"schedule_id": row.id, "tool_id": row.tool_id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"schedule_id": row.id, "inference": "due_suspected"}


@router.post("/schedules/{schedule_id}/confirm")
async def confirm_maintenance(
    schedule_id: str,
    body: MaintenanceConfirm,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    log = MaintenanceLog(
        company_id=user.company_id,
        schedule_id=schedule_id,
        confirmed_by_user_id=user.id,
        notes=body.notes,
        inference_triggered=body.inference_triggered,
    )
    db.add(log)
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="maintenance.confirmed",
            company_id=user.company_id,
            entity_id=log.id,
            metadata={"log_id": log.id, "schedule_id": schedule_id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"log_id": log.id}


@router.get("/logs")
async def list_logs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    schedule_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = select(MaintenanceLog).where(MaintenanceLog.company_id == user.company_id)
    if schedule_id:
        stmt = stmt.where(MaintenanceLog.schedule_id == schedule_id)
    q = await db.execute(stmt)
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "schedule_id": r.schedule_id,
            "performed_at": r.performed_at,
            "confirmed_by": r.confirmed_by_user_id,
            "notes": r.notes,
            "inference_triggered": r.inference_triggered,
        }
        for r in rows
    ]
