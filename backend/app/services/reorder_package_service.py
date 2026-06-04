"""Central orchestration for inventory reorder package generation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.reorder_outputs import ReorderOutputType, resolve_reorder_outputs_from_settings
from app.models.domain import Company, InventoryModuleSettings, ReorderPackageExport, User
from app.services.material_request_queue_service import get_queue_rows_for_export, mark_queue_rows_exported
from app.services.reorder_output_handlers import ReorderHandlerContext, ReorderOutputResult, process_reorder_output


async def _load_inventory_settings(db: AsyncSession, company_id: str) -> dict[str, Any]:
    q = await db.execute(
        select(InventoryModuleSettings).where(InventoryModuleSettings.company_id == company_id)
    )
    row = q.scalar_one_or_none()
    return dict(row.settings) if row and isinstance(row.settings, dict) else {}


async def generate_reorder_package(
    db: AsyncSession,
    company_id: str,
    user: User | None,
    *,
    queue_item_ids: list[str],
    project: str,
    location: str,
    cost_object: str = "",
    comments: str = "",
    notify_emails: list[str] | None = None,
    outputs: Optional[list[str]] = None,
) -> tuple[ReorderPackageExport, list[ReorderOutputResult]]:
    project = (project or "").strip()
    location = (location or "").strip()
    if not project:
        raise HTTPException(status_code=400, detail="Project is required")
    if not location:
        raise HTTPException(status_code=400, detail="Job description / location is required")

    unique_ids = list(dict.fromkeys(queue_item_ids))
    if not unique_ids:
        raise HTTPException(status_code=400, detail="Select at least one queue item")

    rows = await get_queue_rows_for_export(db, company_id, unique_ids)
    if len(rows) != len(unique_ids):
        raise HTTPException(status_code=400, detail="One or more queue items are missing or not available for export")

    inv_settings = await _load_inventory_settings(db, company_id)
    enabled: list[ReorderOutputType]
    if outputs:
        from app.core.reorder_outputs import normalize_reorder_outputs

        inv_block = inv_settings.get("inventory")
        procurement_mode = inv_block.get("procurement_mode") if isinstance(inv_block, dict) else None
        enabled = normalize_reorder_outputs(outputs, procurement_mode=procurement_mode)
    else:
        enabled = resolve_reorder_outputs_from_settings(inv_settings)

    if not enabled:
        raise HTTPException(status_code=400, detail="No reorder outputs are enabled for this organization")

    co = await db.get(Company, company_id)
    company_name = co.name if co else "Your organization"
    batch_id = str(uuid4())

    ctx = ReorderHandlerContext(
        db=db,
        company_id=company_id,
        user=user,
        rows=rows,
        project=project,
        location=location,
        cost_object=cost_object or "",
        comments=comments or "",
        company_name=company_name,
        notify_emails=notify_emails,
        inv_settings=inv_settings,
        batch_id=batch_id,
    )

    results: list[ReorderOutputResult] = []
    for output_type in enabled:
        result = await process_reorder_output(output_type, ctx)
        results.append(result)

    successful = [r for r in results if r.success]
    if not successful:
        raise HTTPException(status_code=400, detail="No reorder outputs were generated")

    await mark_queue_rows_exported(db, rows, export_batch_id=batch_id)

    now = datetime.now(timezone.utc)
    package_record = ReorderPackageExport(
        id=batch_id,
        company_id=company_id,
        created_by_user_id=user.id if user else None,
        created_at=now,
        project=project,
        location=location,
        cost_object=cost_object or None,
        comments=comments or None,
        item_count=len(rows),
        outputs=_serialize_outputs(results),
    )
    db.add(package_record)
    await db.flush()

    return package_record, results


def _serialize_outputs(results: list[ReorderOutputResult]) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for result in results:
        payload = {
            "output_type": result.output_type,
            "success": result.success,
            "label": result.label,
            "detail": result.detail,
            "data": result.data,
        }
        if result.output_type == "material_requisition" and result.data.get("file_base64"):
            slim = dict(result.data)
            slim.pop("file_base64", None)
            payload["data"] = slim
        serialized.append(payload)
    return serialized
