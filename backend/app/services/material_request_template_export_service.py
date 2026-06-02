"""Material request queue export using kent_material_request.xlsx template."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, MaterialRequestExport, MaterialRequestQueue, User
from app.services.material_request_queue_service import (
    QUEUE_STATUS_EXPORTED,
    QUEUE_STATUS_PENDING,
    get_queue_rows_for_export,
)
from app.services.template_export_service import TemplateExportError, TemplateExportService


def _queue_row_payload(row: MaterialRequestQueue) -> dict[str, Any]:
    reimb = bool(row.reimbursable) if row.reimbursable is not None else False
    return {
        "item_name": row.item_name,
        "vendor": row.vendor,
        "vendor_part_number": row.vendor_part_number or row.sku,
        "quantity": float(row.reorder_qty),
        "unit": row.unit or "EACH",
        "reimbursable": reimb,
    }


async def export_queue_to_workbook(
    db: AsyncSession,
    company_id: str,
    user: User | None,
    *,
    queue_item_ids: list[str],
    project: str,
    location: str,
    cost_object: str,
    comments: str,
) -> tuple[bytes, str, MaterialRequestExport]:
    project = (project or "").strip()
    location = (location or "").strip()
    if not project:
        raise HTTPException(status_code=400, detail="Project is required")
    if not location:
        raise HTTPException(status_code=400, detail="Job description / location is required")

    unique_ids = list(dict.fromkeys(queue_item_ids))
    if not unique_ids:
        raise HTTPException(status_code=400, detail="Select at least one queue item to export")

    rows = await get_queue_rows_for_export(db, company_id, unique_ids)
    if len(rows) != len(unique_ids):
        raise HTTPException(status_code=400, detail="One or more queue items are missing or not available for export")

    # Backfill unit from inventory when queue snapshot lacks it.
    item_ids = [r.inventory_item_id for r in rows if not r.unit]
    inv_by_id: dict[str, InventoryItem] = {}
    if item_ids:
        q = await db.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))
        inv_by_id = {i.id: i for i in q.scalars().all()}
    for row in rows:
        if not row.unit and row.inventory_item_id in inv_by_id:
            row.unit = inv_by_id[row.inventory_item_id].unit

    payloads = [_queue_row_payload(r) for r in rows]
    engine = TemplateExportService()
    try:
        data, filename = engine.export(
            payloads,
            project=project,
            location=location,
            cost_object=cost_object or "",
            comments=comments or "",
            export_date=date.today(),
        )
    except TemplateExportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    now = datetime.now(timezone.utc)
    export_record = MaterialRequestExport(
        id=str(uuid4()),
        company_id=company_id,
        created_by_user_id=user.id if user else None,
        created_at=now,
        project=project,
        location=location,
        cost_object=cost_object or None,
        comments=comments or None,
        item_count=len(rows),
        file_name=filename,
    )
    db.add(export_record)
    await db.flush()

    for row in rows:
        row.status = QUEUE_STATUS_EXPORTED
        row.exported_at = now
        row.export_batch_id = export_record.id
        row.updated_at = now

    return data, filename, export_record


async def list_export_history(db: AsyncSession, company_id: str, *, limit: int = 50) -> list[MaterialRequestExport]:
    q = await db.execute(
        select(MaterialRequestExport)
        .where(MaterialRequestExport.company_id == company_id)
        .order_by(MaterialRequestExport.created_at.desc())
        .limit(limit)
    )
    return list(q.scalars().all())
