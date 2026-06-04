"""Material request queue export using kent_material_request.xlsx template."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email_smtp import send_material_request_export_email
from app.models.domain import Company, InventoryItem, InventoryModuleSettings, MaterialRequestExport, MaterialRequestQueue, User
from app.services.inventory_notifications import notifications_from_settings, parse_email_list
from app.services.material_request_queue_service import get_queue_rows_for_export, mark_queue_rows_exported
from app.services.template_export_service import TemplateExportError, TemplateExportService


def resolve_material_request_requester_name(user: User | None) -> str:
    """Display name for MR template Requester field (profile full name preferred)."""
    if user is None:
        return ""
    name = (user.full_name or "").strip()
    if name:
        return name
    email = (user.email or "").strip()
    if email and "@" in email:
        return email.split("@", 1)[0].replace(".", " ").replace("_", " ").title()
    return email


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


async def _load_inventory_settings(db: AsyncSession, company_id: str) -> dict:
    q = await db.execute(
        select(InventoryModuleSettings).where(InventoryModuleSettings.company_id == company_id)
    )
    row = q.scalar_one_or_none()
    return dict(row.settings) if row and isinstance(row.settings, dict) else {}


def resolve_mr_export_recipients(
    inv_settings: dict,
    requested: list[str] | None,
) -> list[str]:
    notif = notifications_from_settings(inv_settings)
    directory = set(notif.email_directory)
    if requested:
        parsed = parse_email_list(requested)
        if directory:
            return [e for e in parsed if e in directory]
        return parsed
    return list(notif.mr_export_emails)


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
    notify_emails: list[str] | None = None,
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
    requester_name = resolve_material_request_requester_name(user)
    engine = TemplateExportService()
    try:
        data, filename = engine.export(
            payloads,
            project=project,
            location=location,
            cost_object=cost_object or "",
            comments=comments or "",
            export_date=date.today(),
            requester_name=requester_name,
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

    await mark_queue_rows_exported(db, rows, export_batch_id=export_record.id)

    inv_settings = await _load_inventory_settings(db, company_id)
    recipients = resolve_mr_export_recipients(inv_settings, notify_emails)
    if recipients:
        settings = get_settings()
        co = await db.get(Company, company_id)
        company_name = co.name if co else "Your organization"
        exported_by = resolve_material_request_requester_name(user) or None
        await send_material_request_export_email(
            settings,
            to_emails=recipients,
            company_name=company_name,
            project=project,
            location=location,
            file_name=filename,
            file_bytes=data,
            item_count=len(rows),
            exported_by=exported_by,
        )

    return data, filename, export_record


async def list_export_history(db: AsyncSession, company_id: str, *, limit: int = 50) -> list[MaterialRequestExport]:
    q = await db.execute(
        select(MaterialRequestExport)
        .where(MaterialRequestExport.company_id == company_id)
        .order_by(MaterialRequestExport.created_at.desc())
        .limit(limit)
    )
    return list(q.scalars().all())
