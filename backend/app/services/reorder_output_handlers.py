"""Pluggable handlers for inventory reorder package outputs."""

from __future__ import annotations

import base64
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Awaitable, Callable, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email_smtp import send_material_request_export_email
from app.core.reorder_outputs import (
    REORDER_OUTPUT_EMAIL_DRAFT,
    REORDER_OUTPUT_MATERIAL_REQUISITION,
    REORDER_OUTPUT_SHOPPING_LIST,
    ReorderOutputType,
)
from app.models.domain import Company, InventoryItem, MaterialRequestExport, MaterialRequestQueue, User
from app.services.material_request_template_export_service import (
    _queue_row_payload,
    resolve_material_request_requester_name,
    resolve_mr_export_recipients,
)
from app.services.template_export_service import TemplateExportError, TemplateExportService

UNASSIGNED_VENDOR_LABEL = "Unassigned Vendor"
EMAIL_DRAFT_SUBJECT = "Inventory Reorder Request"


@dataclass
class ReorderHandlerContext:
    db: AsyncSession
    company_id: str
    user: User | None
    rows: list[MaterialRequestQueue]
    project: str
    location: str
    cost_object: str
    comments: str
    company_name: str
    notify_emails: list[str] | None
    inv_settings: dict[str, Any]
    batch_id: str
    mark_exported: bool = True
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReorderOutputResult:
    output_type: ReorderOutputType
    success: bool
    label: str
    detail: Optional[str] = None
    data: dict[str, Any] = field(default_factory=dict)


async def _ensure_row_units(db: AsyncSession, rows: list[MaterialRequestQueue]) -> None:
    item_ids = [r.inventory_item_id for r in rows if not r.unit]
    if not item_ids:
        return
    q = await db.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))
    inv_by_id = {i.id: i for i in q.scalars().all()}
    for row in rows:
        if not row.unit and row.inventory_item_id in inv_by_id:
            row.unit = inv_by_id[row.inventory_item_id].unit


def _shopping_list_line(row: MaterialRequestQueue) -> dict[str, Any]:
    sku = (row.sku or row.vendor_part_number or "").strip()
    vendor = (row.vendor or "").strip() or UNASSIGNED_VENDOR_LABEL
    unit = (row.unit or "EACH").strip()
    qty = float(row.reorder_qty)
    return {
        "item_name": row.item_name,
        "sku": sku,
        "reorder_qty": qty,
        "vendor": vendor,
        "unit": unit,
        "display": f"{row.item_name} x{qty:g}" + (f" ({sku})" if sku else ""),
    }


def _group_lines_by_vendor(rows: list[MaterialRequestQueue]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        line = _shopping_list_line(row)
        groups[line["vendor"]].append(line)
    ordered_vendors = sorted(groups.keys(), key=lambda v: (v == UNASSIGNED_VENDOR_LABEL, v.lower()))
    return [{"vendor": vendor, "items": groups[vendor]} for vendor in ordered_vendors]


def _format_shopping_list_text(company_name: str, vendor_groups: list[dict[str, Any]]) -> str:
    lines = ["SHOPPING LIST", "", company_name, ""]
    for group in vendor_groups:
        vendor = group["vendor"]
        if vendor != UNASSIGNED_VENDOR_LABEL:
            lines.append(f"Vendor: {vendor}")
        for item in group["items"]:
            lines.append(f"☐ {item['display']}")
        lines.append("")
    return "\n".join(lines).strip()


def _format_email_draft_body(company_name: str, vendor: str, items: list[dict[str, Any]], comments: str) -> str:
    lines = [
        f"Organization: {company_name}",
        "",
        "Please provide pricing and availability for the following items:",
        "",
    ]
    for item in items:
        sku = item.get("sku") or ""
        sku_part = f" (SKU: {sku})" if sku else ""
        unit = item.get("unit") or "EACH"
        lines.append(f"- {item['item_name']}{sku_part}: {item['reorder_qty']:g} {unit}")
    if comments.strip():
        lines.extend(["", "Comments:", comments.strip()])
    if vendor != UNASSIGNED_VENDOR_LABEL:
        lines.extend(["", f"Preferred vendor: {vendor}"])
    return "\n".join(lines)


async def handle_material_requisition(ctx: ReorderHandlerContext) -> ReorderOutputResult:
    project = (ctx.project or "").strip()
    location = (ctx.location or "").strip()
    if not project:
        raise HTTPException(status_code=400, detail="Project is required for material requisition export")
    if not location:
        raise HTTPException(status_code=400, detail="Job description / location is required")

    await _ensure_row_units(ctx.db, ctx.rows)
    payloads = [_queue_row_payload(r) for r in ctx.rows]
    requester_name = resolve_material_request_requester_name(ctx.user)
    engine = TemplateExportService()
    try:
        data, filename = engine.export(
            payloads,
            project=project,
            location=location,
            cost_object=ctx.cost_object or "",
            comments=ctx.comments or "",
            export_date=date.today(),
            requester_name=requester_name,
        )
    except TemplateExportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    now = datetime.now(timezone.utc)
    export_record = MaterialRequestExport(
        id=str(uuid4()),
        company_id=ctx.company_id,
        created_by_user_id=ctx.user.id if ctx.user else None,
        created_at=now,
        project=project,
        location=location,
        cost_object=ctx.cost_object or None,
        comments=ctx.comments or None,
        item_count=len(ctx.rows),
        file_name=filename,
    )
    ctx.db.add(export_record)
    await ctx.db.flush()

    recipients = resolve_mr_export_recipients(ctx.inv_settings, ctx.notify_emails)
    if recipients:
        settings = get_settings()
        exported_by = resolve_material_request_requester_name(ctx.user) or None
        await send_material_request_export_email(
            settings,
            to_emails=recipients,
            company_name=ctx.company_name,
            project=project,
            location=location,
            file_name=filename,
            file_bytes=data,
            item_count=len(ctx.rows),
            exported_by=exported_by,
        )

    mr_number = f"MR-{export_record.id[:8].upper()}"
    return ReorderOutputResult(
        output_type=REORDER_OUTPUT_MATERIAL_REQUISITION,
        success=True,
        label=f"Material Requisition {mr_number}",
        detail=filename,
        data={
            "export_id": export_record.id,
            "mr_number": mr_number,
            "file_name": filename,
            "file_base64": base64.b64encode(data).decode("ascii"),
            "media_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    )


async def handle_email_draft(ctx: ReorderHandlerContext) -> ReorderOutputResult:
    vendor_groups = _group_lines_by_vendor(ctx.rows)
    drafts = []
    for group in vendor_groups:
        vendor = group["vendor"]
        body = _format_email_draft_body(ctx.company_name, vendor, group["items"], ctx.comments)
        drafts.append(
            {
                "vendor": vendor,
                "subject": EMAIL_DRAFT_SUBJECT,
                "body": body,
            }
        )
    return ReorderOutputResult(
        output_type=REORDER_OUTPUT_EMAIL_DRAFT,
        success=True,
        label=f"Email Drafts ({len(drafts)})",
        data={"drafts": drafts},
    )


async def handle_shopping_list(ctx: ReorderHandlerContext) -> ReorderOutputResult:
    vendor_groups = _group_lines_by_vendor(ctx.rows)
    plain_text = _format_shopping_list_text(ctx.company_name, vendor_groups)
    return ReorderOutputResult(
        output_type=REORDER_OUTPUT_SHOPPING_LIST,
        success=True,
        label="Shopping List",
        data={
            "title": "SHOPPING LIST",
            "organization": ctx.company_name,
            "vendor_groups": vendor_groups,
            "plain_text": plain_text,
        },
    )


ReorderOutputHandler = Callable[[ReorderHandlerContext], Awaitable[ReorderOutputResult]]

REORDER_OUTPUT_HANDLERS: dict[ReorderOutputType, ReorderOutputHandler] = {
    REORDER_OUTPUT_MATERIAL_REQUISITION: handle_material_requisition,
    REORDER_OUTPUT_EMAIL_DRAFT: handle_email_draft,
    REORDER_OUTPUT_SHOPPING_LIST: handle_shopping_list,
}


async def process_reorder_output(output_type: ReorderOutputType, ctx: ReorderHandlerContext) -> ReorderOutputResult:
    handler = REORDER_OUTPUT_HANDLERS.get(output_type)
    if handler is None:
        return ReorderOutputResult(
            output_type=output_type,
            success=False,
            label=str(output_type),
            detail="Unsupported reorder output type",
        )
    return await handler(ctx)
