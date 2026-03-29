from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import PMSchedule, RequestStatus, WorkOrder, WorkOrderStatus, WorkRequest


async def summary(db: AsyncSession, company_id: str) -> dict[str, int]:
    active = await db.scalar(
        select(func.count())
        .select_from(WorkOrder)
        .where(
            WorkOrder.company_id == company_id,
            WorkOrder.status.in_(
                [WorkOrderStatus.open, WorkOrderStatus.in_progress, WorkOrderStatus.on_hold]
            ),
        )
    )
    pending = await db.scalar(
        select(func.count())
        .select_from(WorkRequest)
        .where(WorkRequest.company_id == company_id, WorkRequest.status == RequestStatus.submitted)
    )
    horizon = datetime.now(timezone.utc) + timedelta(days=14)
    upcoming = await db.scalar(
        select(func.count())
        .select_from(PMSchedule)
        .where(
            PMSchedule.company_id == company_id,
            PMSchedule.is_active.is_(True),
            PMSchedule.next_due_at.is_not(None),
            PMSchedule.next_due_at <= horizon,
        )
    )
    return {
        "active_work_orders": int(active or 0),
        "pending_requests": int(pending or 0),
        "upcoming_pm_schedules": int(upcoming or 0),
    }
