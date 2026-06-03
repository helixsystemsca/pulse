"""Material request queue and draft API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_any_rbac
from app.api.inventory_portal_routes import CompanyId
from app.models.domain import User
from app.schemas.material_requests import (
    MaterialRequestCreateDraftIn,
    MaterialRequestDraftCreatedOut,
    MaterialRequestDraftItemOut,
    MaterialRequestDraftOut,
    MaterialRequestExportListOut,
    MaterialRequestExportOut,
    MaterialRequestQueueExportIn,
    MaterialRequestQueueListOut,
    MaterialRequestQueueOut,
    MaterialRequestQueuePatchIn,
)
from app.services import material_request_export_service as export_svc
from app.services import material_request_queue_service as queue_svc
from app.services import material_request_service as draft_svc
from app.services import material_request_template_export_service as template_export_svc

router = APIRouter(prefix="/material-requests", tags=["material-requests"])

Db = Annotated[AsyncSession, Depends(get_db)]
InvUser = Annotated[User, Depends(require_any_rbac("inventory.view", "inventory.manage"))]
InvManageUser = Annotated[User, Depends(require_any_rbac("inventory.manage"))]


def _queue_out(row) -> MaterialRequestQueueOut:
    return MaterialRequestQueueOut(
        id=row.id,
        inventory_item_id=row.inventory_item_id,
        item_name=row.item_name,
        sku=row.sku,
        category=row.category,
        vendor=row.vendor,
        vendor_part_number=row.vendor_part_number,
        unit=row.unit,
        reimbursable=row.reimbursable,
        current_qty=row.current_qty,
        minimum_qty=row.minimum_qty,
        maximum_qty=row.maximum_qty,
        reorder_qty=row.reorder_qty,
        priority_score=float(getattr(row, "priority_score", 0) or 0),
        days_until_stockout=getattr(row, "days_until_stockout", None),
        urgency_tier=getattr(row, "urgency_tier", None) or "normal",
        anomaly_flag=bool(getattr(row, "anomaly_flag", False)),
        estimated_unit_cost=row.estimated_unit_cost,
        status=row.status,
        exported_at=row.exported_at,
        export_batch_id=row.export_batch_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _draft_out(draft, items) -> MaterialRequestDraftOut:
    line_out = [
        MaterialRequestDraftItemOut(
            id=it.id,
            queue_item_id=it.queue_item_id,
            item_name=it.item_name,
            sku=it.sku,
            vendor=it.vendor,
            qty_requested=it.qty_requested,
            estimated_unit_cost=it.estimated_unit_cost,
            estimated_cost=it.estimated_cost,
        )
        for it in items
    ]
    return MaterialRequestDraftOut(
        id=draft.id,
        draft_number=draft.draft_number,
        created_by_user_id=draft.created_by_user_id,
        created_at=draft.created_at,
        status=draft.status,
        items=line_out,
        estimated_total_cost=draft_svc.draft_estimated_total(items),
    )


@router.get("/queue", response_model=MaterialRequestQueueListOut)
async def list_material_request_queue(
    db: Db,
    _: InvUser,
    cid: CompanyId,
) -> MaterialRequestQueueListOut:
    rows = await queue_svc.list_pending_queue(db, cid)
    return MaterialRequestQueueListOut(items=[_queue_out(r) for r in rows])


@router.patch("/queue/{queue_id}", response_model=MaterialRequestQueueOut)
async def patch_material_request_queue_item(
    db: Db,
    _: InvManageUser,
    cid: CompanyId,
    queue_id: str,
    body: MaterialRequestQueuePatchIn,
) -> MaterialRequestQueueOut:
    row = await queue_svc.get_queue_row(db, cid, queue_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    if row.status not in queue_svc.QUEUE_ACTIVE_STATUSES:
        raise HTTPException(status_code=400, detail="Only active queue items can be edited")
    if (
        body.reorder_qty is None
        and body.reimbursable is None
        and body.vendor_part_number is None
        and body.unit is None
    ):
        raise HTTPException(status_code=400, detail="No fields to update")
    await queue_svc.patch_queue_item(
        db,
        row,
        reorder_qty=body.reorder_qty,
        reimbursable=body.reimbursable,
        vendor_part_number=body.vendor_part_number,
        unit=body.unit,
    )
    await db.commit()
    await db.refresh(row)
    return _queue_out(row)


@router.post("/queue/{queue_id}/remove", status_code=204)
async def remove_material_request_queue_item(
    db: Db,
    _: InvManageUser,
    cid: CompanyId,
    queue_id: str,
) -> None:
    row = await queue_svc.get_queue_row(db, cid, queue_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    await queue_svc.remove_from_queue(db, row)
    await db.commit()


@router.post("/queue/clear", status_code=204)
async def clear_material_request_queue(
    db: Db,
    _: InvManageUser,
    cid: CompanyId,
) -> None:
    await queue_svc.clear_active_queue(db, cid)
    await db.commit()


@router.post("/queue/export")
async def export_material_request_queue(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    body: MaterialRequestQueueExportIn,
) -> Response:
    data, filename, _record = await template_export_svc.export_queue_to_workbook(
        db,
        cid,
        user,
        queue_item_ids=body.queue_item_ids,
        project=body.project,
        location=body.location,
        cost_object=body.cost_object or "",
        comments=body.comments or "",
        notify_emails=body.notify_emails,
    )
    await db.commit()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports", response_model=MaterialRequestExportListOut)
async def list_material_request_exports(
    db: Db,
    _: InvUser,
    cid: CompanyId,
) -> MaterialRequestExportListOut:
    rows = await template_export_svc.list_export_history(db, cid)
    return MaterialRequestExportListOut(
        items=[
            MaterialRequestExportOut(
                id=r.id,
                project=r.project,
                location=r.location,
                cost_object=r.cost_object,
                item_count=r.item_count,
                file_name=r.file_name,
                created_by_user_id=r.created_by_user_id,
                created_at=r.created_at,
            )
            for r in rows
        ]
    )


@router.post("/create-draft", response_model=MaterialRequestDraftCreatedOut, status_code=201)
async def create_material_request_draft(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    body: MaterialRequestCreateDraftIn,
) -> MaterialRequestDraftCreatedOut:
    draft = await draft_svc.create_draft_from_queue(db, cid, user.id, body.queue_item_ids)
    await db.commit()
    items = await draft_svc.load_draft_items(db, draft.id)
    return MaterialRequestDraftCreatedOut(draft=_draft_out(draft, items))


@router.get("/drafts/{draft_id}", response_model=MaterialRequestDraftOut)
async def get_material_request_draft(
    db: Db,
    _: InvUser,
    cid: CompanyId,
    draft_id: str,
) -> MaterialRequestDraftOut:
    draft = await draft_svc.get_draft(db, cid, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Not found")
    items = await draft_svc.load_draft_items(db, draft.id)
    return _draft_out(draft, items)


@router.post("/drafts/{draft_id}/submit", response_model=MaterialRequestDraftOut)
async def submit_material_request_draft(
    db: Db,
    _: InvManageUser,
    cid: CompanyId,
    draft_id: str,
) -> MaterialRequestDraftOut:
    draft = await draft_svc.get_draft(db, cid, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Not found")
    await draft_svc.submit_draft(db, draft)
    await db.commit()
    items = await draft_svc.load_draft_items(db, draft.id)
    return _draft_out(draft, items)


@router.post("/drafts/{draft_id}/export")
async def export_material_request_draft(
    db: Db,
    _: InvUser,
    cid: CompanyId,
    draft_id: str,
) -> Response:
    draft = await draft_svc.get_draft(db, cid, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Not found")
    items = await draft_svc.load_draft_items(db, draft.id)
    data, filename = export_svc.build_material_request_workbook(draft, items)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
