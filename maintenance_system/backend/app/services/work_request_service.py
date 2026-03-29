from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import RequestStatus, WorkOrder, WorkRequest
from app.schemas.work_request import WorkRequestCreate, WorkRequestUpdateStatus
from app.services import work_order_service


async def list_requests(
    db: AsyncSession,
    company_id: str,
    *,
    status_filter: RequestStatus | None,
    q: str | None,
    user_id: str | None,
    manager_view: bool,
) -> list[WorkRequest]:
    stmt = select(WorkRequest).where(WorkRequest.company_id == company_id).order_by(WorkRequest.created_at.desc())
    if not manager_view and user_id:
        stmt = stmt.where(WorkRequest.requested_by_user_id == user_id)
    if status_filter:
        stmt = stmt.where(WorkRequest.status == status_filter)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((WorkRequest.title.ilike(like)) | (WorkRequest.description.ilike(like)))
    result = await db.execute(stmt)
    return list(result.scalars())


async def create_request(db: AsyncSession, company_id: str, requested_by_user_id: str, data: WorkRequestCreate) -> WorkRequest:
    if data.asset_id:
        from app.services.asset_service import get_asset

        if await get_asset(db, company_id, data.asset_id) is None:
            raise ValueError("Asset not found")
    wr = WorkRequest(
        company_id=company_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        location=data.location,
        asset_id=data.asset_id,
        requested_by_user_id=requested_by_user_id,
        status=RequestStatus.submitted,
    )
    db.add(wr)
    await db.flush()
    await db.refresh(wr)
    return wr


async def get_request(db: AsyncSession, company_id: str, request_id: str) -> WorkRequest | None:
    result = await db.execute(select(WorkRequest).where(WorkRequest.company_id == company_id, WorkRequest.id == request_id))
    return result.scalar_one_or_none()


async def set_status(
    db: AsyncSession,
    req: WorkRequest,
    data: WorkRequestUpdateStatus,
) -> WorkRequest:
    if data.status not in (RequestStatus.approved, RequestStatus.rejected):
        raise ValueError("Invalid status for this action")
    if req.status != RequestStatus.submitted:
        raise ValueError("Only submitted requests can be approved or rejected")
    if data.status == RequestStatus.rejected:
        req.status = RequestStatus.rejected
        req.rejected_reason = data.rejected_reason or ""
    else:
        req.status = RequestStatus.approved
        req.rejected_reason = None
    await db.flush()
    await db.refresh(req)
    return req


async def convert_to_work_order(
    db: AsyncSession,
    req: WorkRequest,
    *,
    created_by_user_id: str,
    assigned_to_user_id: str | None,
    due_date: datetime | None,
) -> WorkOrder:
    if req.status != RequestStatus.approved:
        raise ValueError("Only approved requests can be converted")
    wo = await work_order_service.create_work_order(
        db,
        company_id=req.company_id,
        created_by_user_id=created_by_user_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        due_date=due_date,
        location=req.location,
        asset_id=req.asset_id,
        assigned_to_user_id=assigned_to_user_id,
        source_request_id=req.id,
        source_pm_schedule_id=None,
    )
    req.status = RequestStatus.converted
    await db.flush()
    await db.refresh(req)
    return wo
