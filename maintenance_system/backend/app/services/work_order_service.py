from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.domain import (
    PMCompletion,
    PMFrequency,
    PMSchedule,
    Priority,
    WorkOrder,
    WorkOrderAttachment,
    WorkOrderNote,
    WorkOrderStatus,
)
from app.schemas.work_order import (
    WorkOrderAssign,
    WorkOrderAttachmentCreate,
    WorkOrderCreate,
    WorkOrderNoteCreate,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
)


async def _next_wo_number(db: AsyncSession, company_id: str) -> str:
    count = await db.scalar(select(func.count()).select_from(WorkOrder).where(WorkOrder.company_id == company_id))
    n = int(count or 0) + 1
    return f"WO-{n:06d}"


async def create_work_order(
    db: AsyncSession,
    *,
    company_id: str,
    created_by_user_id: str | None,
    title: str,
    description: str,
    priority: Priority,
    due_date: datetime | None,
    location: str,
    asset_id: str | None,
    assigned_to_user_id: str | None,
    source_request_id: str | None,
    source_pm_schedule_id: str | None,
) -> WorkOrder:
    if asset_id:
        from app.services.asset_service import get_asset

        if await get_asset(db, company_id, asset_id) is None:
            raise ValueError("Asset not found")
    wo = WorkOrder(
        company_id=company_id,
        work_order_number=await _next_wo_number(db, company_id),
        title=title,
        description=description,
        priority=priority,
        due_date=due_date,
        location=location,
        asset_id=asset_id,
        assigned_to_user_id=assigned_to_user_id,
        source_request_id=source_request_id,
        source_pm_schedule_id=source_pm_schedule_id,
        created_by_user_id=created_by_user_id,
        status=WorkOrderStatus.open,
    )
    db.add(wo)
    await db.flush()
    await db.refresh(wo)
    return wo


async def create_from_schema(db: AsyncSession, company_id: str, created_by_user_id: str | None, data: WorkOrderCreate) -> WorkOrder:
    return await create_work_order(
        db,
        company_id=company_id,
        created_by_user_id=created_by_user_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        due_date=data.due_date,
        location=data.location,
        asset_id=data.asset_id,
        assigned_to_user_id=data.assigned_to_user_id,
        source_request_id=data.source_request_id,
        source_pm_schedule_id=None,
    )


async def list_work_orders(
    db: AsyncSession,
    company_id: str,
    *,
    status_filter: WorkOrderStatus | None,
    q: str | None,
    assigned_to_user_id: str | None,
) -> list[WorkOrder]:
    stmt = select(WorkOrder).where(WorkOrder.company_id == company_id).order_by(WorkOrder.created_at.desc())
    if status_filter:
        stmt = stmt.where(WorkOrder.status == status_filter)
    if assigned_to_user_id:
        stmt = stmt.where(WorkOrder.assigned_to_user_id == assigned_to_user_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (WorkOrder.title.ilike(like))
            | (WorkOrder.description.ilike(like))
            | (WorkOrder.work_order_number.ilike(like))
        )
    result = await db.execute(stmt)
    return list(result.scalars())


async def get_work_order(db: AsyncSession, company_id: str, work_order_id: str, *, with_children: bool = False) -> WorkOrder | None:
    stmt = select(WorkOrder).where(WorkOrder.company_id == company_id, WorkOrder.id == work_order_id)
    if with_children:
        stmt = stmt.options(selectinload(WorkOrder.notes), selectinload(WorkOrder.attachments))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_work_order(db: AsyncSession, wo: WorkOrder, data: WorkOrderUpdate) -> WorkOrder:
    if data.title is not None:
        wo.title = data.title
    if data.description is not None:
        wo.description = data.description
    if data.priority is not None:
        wo.priority = data.priority
    if data.due_date is not None:
        wo.due_date = data.due_date
    if data.location is not None:
        wo.location = data.location
    if data.asset_id is not None:
        if data.asset_id:
            from app.services.asset_service import get_asset

            if await get_asset(db, wo.company_id, data.asset_id) is None:
                raise ValueError("Asset not found")
        wo.asset_id = data.asset_id
    await db.flush()
    await db.refresh(wo)
    return wo


async def assign_work_order(db: AsyncSession, wo: WorkOrder, data: WorkOrderAssign) -> WorkOrder:
    wo.assigned_to_user_id = data.assigned_to_user_id
    await db.flush()
    await db.refresh(wo)
    return wo


async def _apply_status_timestamps(wo: WorkOrder, new_status: WorkOrderStatus) -> None:
    now = datetime.now(timezone.utc)
    if new_status == WorkOrderStatus.in_progress and wo.started_at is None:
        wo.started_at = now
    if new_status in (WorkOrderStatus.completed, WorkOrderStatus.closed):
        wo.completed_at = now


async def update_status(db: AsyncSession, wo: WorkOrder, data: WorkOrderStatusUpdate, actor_user_id: str) -> WorkOrder:
    prev = wo.status
    wo.status = data.status
    await _apply_status_timestamps(wo, data.status)

    became_done = data.status in (WorkOrderStatus.completed, WorkOrderStatus.closed) and prev not in (
        WorkOrderStatus.completed,
        WorkOrderStatus.closed,
    )
    if became_done and wo.source_pm_schedule_id:
        from app.services import pm_service as _pm

        await _pm.record_pm_completion_from_work_order(db, wo, completed_by_user_id=actor_user_id)

    await db.flush()
    await db.refresh(wo)
    return wo


async def add_note(db: AsyncSession, wo: WorkOrder, author_user_id: str, data: WorkOrderNoteCreate) -> WorkOrderNote:
    note = WorkOrderNote(
        company_id=wo.company_id,
        work_order_id=wo.id,
        author_user_id=author_user_id,
        body=data.body,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


async def add_attachment(db: AsyncSession, wo: WorkOrder, uploaded_by_user_id: str, data: WorkOrderAttachmentCreate) -> WorkOrderAttachment:
    att = WorkOrderAttachment(
        company_id=wo.company_id,
        work_order_id=wo.id,
        uploaded_by_user_id=uploaded_by_user_id,
        filename=data.filename,
        content_type=data.content_type,
        storage_uri=f"placeholder://pending/{uuid4().hex}",
    )
    db.add(att)
    await db.flush()
    await db.refresh(att)
    return att
