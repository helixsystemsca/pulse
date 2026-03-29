from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, ManagerUser, can_update_work_order_status, can_view_work_order, is_manager_plus
from app.models.domain import WorkOrderStatus
from app.schemas.work_order import (
    WorkOrderAssign,
    WorkOrderAttachmentCreate,
    WorkOrderAttachmentOut,
    WorkOrderCreate,
    WorkOrderDetail,
    WorkOrderNoteCreate,
    WorkOrderNoteOut,
    WorkOrderOut,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
)
from app.services.audit import write_audit
from app.services import work_order_service
from app.services.notify import log_notification

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.get("", response_model=list[WorkOrderOut])
async def list_work_orders(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status_filter: WorkOrderStatus | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[WorkOrderOut]:
    assigned_filter = None if is_manager_plus(current) else current.id
    rows = await work_order_service.list_work_orders(
        db,
        current.company_id,
        status_filter=status_filter,
        q=q,
        assigned_to_user_id=assigned_filter,
    )
    return [WorkOrderOut.model_validate(r) for r in rows]


@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    data: WorkOrderCreate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    try:
        wo = await work_order_service.create_from_schema(db, mgr.company_id, mgr.id, data)
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="work_order.create",
            entity_type="work_order",
            entity_id=wo.id,
            payload={"number": wo.work_order_number},
        )
        await log_notification(
            db,
            company_id=mgr.company_id,
            user_id=wo.assigned_to_user_id,
            title="Work order assigned",
            body=wo.work_order_number,
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkOrderOut.model_validate(wo)


@router.get("/{work_order_id}", response_model=WorkOrderDetail)
async def get_work_order(
    work_order_id: str,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderDetail:
    wo = await work_order_service.get_work_order(db, current.company_id, work_order_id, with_children=True)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_view_work_order(current, wo):
        raise HTTPException(status_code=403, detail="Forbidden")
    return WorkOrderDetail(
        **WorkOrderOut.model_validate(wo).model_dump(),
        notes=[WorkOrderNoteOut.model_validate(n) for n in wo.notes],
        attachments=[WorkOrderAttachmentOut.model_validate(a) for a in wo.attachments],
    )


@router.patch("/{work_order_id}", response_model=WorkOrderOut)
async def patch_work_order(
    work_order_id: str,
    data: WorkOrderUpdate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    wo = await work_order_service.get_work_order(db, mgr.company_id, work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        wo = await work_order_service.update_work_order(db, wo, data)
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="work_order.update",
            entity_type="work_order",
            entity_id=wo.id,
            payload=data.model_dump(exclude_unset=True),
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkOrderOut.model_validate(wo)


@router.post("/{work_order_id}/assign", response_model=WorkOrderOut)
async def assign_work_order(
    work_order_id: str,
    data: WorkOrderAssign,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    wo = await work_order_service.get_work_order(db, mgr.company_id, work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    wo = await work_order_service.assign_work_order(db, wo, data)
    await write_audit(
        db,
        company_id=mgr.company_id,
        actor_user_id=mgr.id,
        action="work_order.assign",
        entity_type="work_order",
        entity_id=wo.id,
        payload={"assigned_to": data.assigned_to_user_id},
    )
    await db.commit()
    return WorkOrderOut.model_validate(wo)


@router.post("/{work_order_id}/status", response_model=WorkOrderOut)
async def update_status(
    work_order_id: str,
    data: WorkOrderStatusUpdate,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    wo = await work_order_service.get_work_order(db, current.company_id, work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_update_work_order_status(current, wo):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        wo = await work_order_service.update_status(db, wo, data, actor_user_id=current.id)
        await write_audit(
            db,
            company_id=current.company_id,
            actor_user_id=current.id,
            action="work_order.status",
            entity_type="work_order",
            entity_id=wo.id,
            payload={"status": data.status.value},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return WorkOrderOut.model_validate(wo)


@router.post("/{work_order_id}/notes", response_model=WorkOrderNoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    work_order_id: str,
    data: WorkOrderNoteCreate,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderNoteOut:
    wo = await work_order_service.get_work_order(db, current.company_id, work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_view_work_order(current, wo):
        raise HTTPException(status_code=403, detail="Forbidden")
    note = await work_order_service.add_note(db, wo, current.id, data)
    await write_audit(
        db,
        company_id=current.company_id,
        actor_user_id=current.id,
        action="work_order.note",
        entity_type="work_order",
        entity_id=wo.id,
        payload={},
    )
    await db.commit()
    return WorkOrderNoteOut.model_validate(note)


@router.post("/{work_order_id}/attachments", response_model=WorkOrderAttachmentOut, status_code=status.HTTP_201_CREATED)
async def add_attachment(
    work_order_id: str,
    data: WorkOrderAttachmentCreate,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> WorkOrderAttachmentOut:
    wo = await work_order_service.get_work_order(db, current.company_id, work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_view_work_order(current, wo):
        raise HTTPException(status_code=403, detail="Forbidden")
    att = await work_order_service.add_attachment(db, wo, current.id, data)
    await write_audit(
        db,
        company_id=current.company_id,
        actor_user_id=current.id,
        action="work_order.attachment",
        entity_type="work_order",
        entity_id=wo.id,
        payload={"filename": data.filename},
    )
    await db.commit()
    return WorkOrderAttachmentOut.model_validate(att)
