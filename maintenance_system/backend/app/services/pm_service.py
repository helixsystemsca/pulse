from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import PMCompletion, PMFrequency, PMSchedule, Priority, WorkOrder, WorkOrderStatus
from app.schemas.pm import PMScheduleCreate, PMScheduleUpdate
from app.services import work_order_service


def _add_interval(start: datetime, frequency: PMFrequency, interval_days: int | None) -> datetime:
    if frequency == PMFrequency.daily:
        return start + timedelta(days=1)
    if frequency == PMFrequency.weekly:
        return start + timedelta(days=7)
    if frequency == PMFrequency.monthly:
        return start + timedelta(days=30)
    if frequency == PMFrequency.custom:
        days = interval_days or 30
        return start + timedelta(days=days)
    return start + timedelta(days=30)


async def list_schedules(db: AsyncSession, company_id: str, active_only: bool | None) -> list[PMSchedule]:
    stmt = select(PMSchedule).where(PMSchedule.company_id == company_id).order_by(PMSchedule.next_due_at)
    if active_only:
        stmt = stmt.where(PMSchedule.is_active.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars())


async def get_schedule(db: AsyncSession, company_id: str, schedule_id: str) -> PMSchedule | None:
    result = await db.execute(select(PMSchedule).where(PMSchedule.company_id == company_id, PMSchedule.id == schedule_id))
    return result.scalar_one_or_none()


async def create_schedule(db: AsyncSession, company_id: str, data: PMScheduleCreate) -> PMSchedule:
    from app.services.asset_service import get_asset

    if await get_asset(db, company_id, data.asset_id) is None:
        raise ValueError("Asset not found")
    if data.frequency == PMFrequency.custom and not data.interval_days:
        raise ValueError("interval_days required for custom frequency")
    now = datetime.now(timezone.utc)
    next_due = data.next_due_at
    if next_due is None:
        next_due = _add_interval(now, data.frequency, data.interval_days)
    pm = PMSchedule(
        company_id=company_id,
        name=data.name,
        asset_id=data.asset_id,
        frequency=data.frequency,
        interval_days=data.interval_days,
        last_completed_at=data.last_completed_at,
        next_due_at=next_due,
        assigned_to_user_id=data.assigned_to_user_id,
        is_active=True,
    )
    db.add(pm)
    await db.flush()
    await db.refresh(pm)
    return pm


async def update_schedule(db: AsyncSession, pm: PMSchedule, data: PMScheduleUpdate) -> PMSchedule:
    if data.name is not None:
        pm.name = data.name
    if data.frequency is not None:
        pm.frequency = data.frequency
    if data.interval_days is not None:
        pm.interval_days = data.interval_days
    if data.assigned_to_user_id is not None:
        pm.assigned_to_user_id = data.assigned_to_user_id
    if data.is_active is not None:
        pm.is_active = data.is_active
    if data.next_due_at is not None:
        pm.next_due_at = data.next_due_at
    if data.last_completed_at is not None:
        pm.last_completed_at = data.last_completed_at
    await db.flush()
    await db.refresh(pm)
    return pm


async def _has_open_pm_work_order(db: AsyncSession, pm_id: str) -> bool:
    stmt = (
        select(WorkOrder.id)
        .where(
            WorkOrder.source_pm_schedule_id == pm_id,
            WorkOrder.status.in_(
                [WorkOrderStatus.open, WorkOrderStatus.in_progress, WorkOrderStatus.on_hold]
            ),
        )
        .limit(1)
    )
    row = await db.execute(stmt)
    return row.scalar_one_or_none() is not None


async def generate_due_work_orders(db: AsyncSession, company_id: str, created_by_user_id: str | None) -> list[WorkOrder]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PMSchedule).where(
            PMSchedule.company_id == company_id,
            PMSchedule.is_active.is_(True),
            PMSchedule.next_due_at.is_not(None),
            PMSchedule.next_due_at <= now,
        )
    )
    created: list[WorkOrder] = []
    for pm in result.scalars():
        if await _has_open_pm_work_order(db, pm.id):
            continue
        asset = pm.asset_id
        wo = await work_order_service.create_work_order(
            db,
            company_id=company_id,
            created_by_user_id=created_by_user_id,
            title=f"PM: {pm.name}",
            description="Preventive maintenance (auto-generated)",
            priority=Priority.medium,
            due_date=pm.next_due_at,
            location="",
            asset_id=asset,
            assigned_to_user_id=pm.assigned_to_user_id,
            source_request_id=None,
            source_pm_schedule_id=pm.id,
        )
        anchor = pm.next_due_at or now
        pm.next_due_at = _add_interval(anchor, pm.frequency, pm.interval_days)
        created.append(wo)
    return created


async def record_pm_completion_from_work_order(db: AsyncSession, wo: WorkOrder, completed_by_user_id: str | None) -> None:
    if not wo.source_pm_schedule_id:
        return
    pm = await get_schedule(db, wo.company_id, wo.source_pm_schedule_id)
    if pm is None:
        return
    now = datetime.now(timezone.utc)
    db.add(
        PMCompletion(
            company_id=wo.company_id,
            pm_schedule_id=pm.id,
            work_order_id=wo.id,
            completed_by_user_id=completed_by_user_id,
            completed_at=now,
            notes=f"Completed via work order {wo.work_order_number}",
        )
    )
    pm.last_completed_at = now
    pm.next_due_at = _add_interval(now, pm.frequency, pm.interval_days)
    await db.flush()


async def list_completions(db: AsyncSession, company_id: str, pm_schedule_id: str | None) -> list[PMCompletion]:
    stmt = select(PMCompletion).where(PMCompletion.company_id == company_id).order_by(PMCompletion.completed_at.desc())
    if pm_schedule_id:
        stmt = stmt.where(PMCompletion.pm_schedule_id == pm_schedule_id)
    result = await db.execute(stmt)
    return list(result.scalars())
