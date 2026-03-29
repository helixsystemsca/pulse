from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, ManagerUser, is_manager_plus
from app.models.domain import RequestStatus
from app.schemas.work_order import WorkOrderOut
from app.schemas.work_request import (
    WorkRequestConvert,
    WorkRequestCreate,
    WorkRequestOut,
    WorkRequestUpdateStatus,
)
from app.services.audit import write_audit
from app.services import work_request_service
from app.services.notify import log_notification

router = APIRouter(prefix="/work-requests", tags=["work-requests"])


class RejectBody(BaseModel):
    reason: str = Field(default="")


def _can_view_request(current, req) -> bool:
    if is_manager_plus(current):
        return True
    return req.requested_by_user_id == current.id


@router.get("", response_model=list[WorkRequestOut])
async def list_work_requests(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status_filter: RequestStatus | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[WorkRequestOut]:
    rows = await work_request_service.list_requests(
        db,
        current.company_id,
        status_filter=status_filter,
        q=q,
        user_id=current.id,
        manager_view=is_manager_plus(current),
    )
    return [WorkRequestOut.model_validate(r) for r in rows]


@router.post("", response_model=WorkRequestOut, status_code=status.HTTP_201_CREATED)
async def create_work_request(
    data: WorkRequestCreate,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkRequestOut:
    try:
        wr = await work_request_service.create_request(db, current.company_id, current.id, data)
        await log_notification(
            db,
            company_id=current.company_id,
            user_id=None,
            title="Work request submitted",
            body=wr.title,
        )
        await write_audit(
            db,
            company_id=current.company_id,
            actor_user_id=current.id,
            action="work_request.create",
            entity_type="work_request",
            entity_id=wr.id,
            payload={"title": wr.title},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkRequestOut.model_validate(wr)


@router.get("/{request_id}", response_model=WorkRequestOut)
async def get_work_request(
    request_id: str,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkRequestOut:
    req = await work_request_service.get_request(db, current.company_id, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_view_request(current, req):
        raise HTTPException(status_code=403, detail="Forbidden")
    return WorkRequestOut.model_validate(req)


@router.post("/{request_id}/approve", response_model=WorkRequestOut)
async def approve_request(
    request_id: str,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> WorkRequestOut:
    req = await work_request_service.get_request(db, mgr.company_id, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        req = await work_request_service.set_status(
            db, req, WorkRequestUpdateStatus(status=RequestStatus.approved)
        )
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="work_request.approve",
            entity_type="work_request",
            entity_id=req.id,
            payload={},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkRequestOut.model_validate(req)


@router.post("/{request_id}/reject", response_model=WorkRequestOut)
async def reject_request(
    request_id: str,
    body: RejectBody,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> WorkRequestOut:
    req = await work_request_service.get_request(db, mgr.company_id, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        req = await work_request_service.set_status(
            db,
            req,
            WorkRequestUpdateStatus(status=RequestStatus.rejected, rejected_reason=body.reason),
        )
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="work_request.reject",
            entity_type="work_request",
            entity_id=req.id,
            payload={"reason": body.reason},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkRequestOut.model_validate(req)


@router.post("/{request_id}/convert", response_model=dict)
async def convert_request(
    request_id: str,
    body: WorkRequestConvert,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    req = await work_request_service.get_request(db, mgr.company_id, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        wo = await work_request_service.convert_to_work_order(
            db,
            req,
            created_by_user_id=mgr.id,
            assigned_to_user_id=body.assigned_to_user_id,
            due_date=body.due_date,
        )
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="work_request.convert",
            entity_type="work_request",
            entity_id=req.id,
            payload={"work_order_id": wo.id},
        )
        await log_notification(
            db,
            company_id=mgr.company_id,
            user_id=wo.assigned_to_user_id,
            title="New work order from request",
            body=wo.work_order_number,
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"work_order": WorkOrderOut.model_validate(wo).model_dump(mode="json")}
