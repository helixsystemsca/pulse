"""Persist inspection runs and create linked corrective work requests."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inspection_models import PulseInspectionItem, PulseInspectionRun
from app.models.pulse_models import PulseWorkOrderSource, PulseWorkRequest, PulseWorkRequestActivity, PulseWorkRequestPriority
from app.modules.work_requests.work_order_number import allocate_work_order_number

FAIL_RESULTS = frozenset({"fail", "failed", "unacceptable", "no", "false"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def item_is_fail(result: Optional[str]) -> bool:
    if not result:
        return False
    return result.strip().lower() in FAIL_RESULTS


def serialize_item(item: PulseInspectionItem) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "run_id": str(item.run_id),
        "title": item.title,
        "result": item.result,
        "notes": item.notes,
        "evidence": list(item.evidence or []),
        "work_request_id": str(item.work_request_id) if item.work_request_id else None,
        "failed": item_is_fail(item.result),
        "sort_order": item.sort_order,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_run(run: PulseInspectionRun) -> dict[str, Any]:
    items = [serialize_item(i) for i in (run.items or [])]
    failed = [i for i in items if i["failed"]]
    return {
        "id": str(run.id),
        "company_id": str(run.company_id),
        "title": run.title,
        "template_key": run.template_key,
        "template_type": run.template_type,
        "status": run.status,
        "overall_result": run.overall_result,
        "facility_id": str(run.facility_id) if run.facility_id else None,
        "equipment_id": str(run.equipment_id) if run.equipment_id else None,
        "zone_id": str(run.zone_id) if run.zone_id else None,
        "notes": run.notes,
        "evidence": list(run.evidence or []),
        "values": dict(run.values or {}),
        "created_by_user_id": str(run.created_by_user_id) if run.created_by_user_id else None,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
        "items": items,
        "failed_count": len(failed),
        "open_corrective_count": sum(1 for i in failed if not i["work_request_id"]),
    }


async def list_runs(db: AsyncSession, company_id: str, *, limit: int = 50) -> list[PulseInspectionRun]:
    stmt = (
        select(PulseInspectionRun)
        .where(PulseInspectionRun.company_id == company_id)
        .options(selectinload(PulseInspectionRun.items))
        .order_by(PulseInspectionRun.created_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_run(db: AsyncSession, company_id: str, run_id: str) -> Optional[PulseInspectionRun]:
    stmt = (
        select(PulseInspectionRun)
        .where(PulseInspectionRun.company_id == company_id, PulseInspectionRun.id == run_id)
        .options(selectinload(PulseInspectionRun.items))
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def _overall_from_items(items: list[dict[str, Any]], explicit: Optional[str]) -> str:
    if explicit:
        raw = explicit.strip().lower()
        if raw in {"pass", "fail", "acceptable", "unacceptable"}:
            return "fail" if raw in {"fail", "unacceptable"} else "pass"
    if any(item_is_fail(str(i.get("result") or "")) for i in items):
        return "fail"
    if items:
        return "pass"
    return "incomplete"


async def create_run(
    db: AsyncSession,
    company_id: str,
    user_id: Optional[str],
    data: dict[str, Any],
) -> PulseInspectionRun:
    raw_items = list(data.get("items") or [])
    overall = _overall_from_items(raw_items, data.get("overall_result"))
    run = PulseInspectionRun(
        id=str(uuid4()),
        company_id=company_id,
        title=(data.get("title") or "Inspection").strip()[:512],
        template_key=(data.get("template_key") or None),
        template_type=(data.get("template_type") or None),
        status=str(data.get("status") or "submitted")[:32],
        overall_result=overall,
        facility_id=data.get("facility_id") or None,
        equipment_id=data.get("equipment_id") or None,
        zone_id=data.get("zone_id") or None,
        notes=data.get("notes") or None,
        evidence=list(data.get("evidence") or []),
        values=dict(data.get("values") or {}),
        created_by_user_id=user_id,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(run)
    await db.flush()
    for idx, raw in enumerate(raw_items):
        db.add(
            PulseInspectionItem(
                id=str(uuid4()),
                company_id=company_id,
                run_id=run.id,
                title=str(raw.get("title") or f"Item {idx + 1}")[:512],
                result=(str(raw["result"]).strip().lower() if raw.get("result") is not None else None),
                notes=raw.get("notes") or None,
                evidence=list(raw.get("evidence") or []),
                sort_order=int(raw.get("sort_order") or idx),
                created_at=_utcnow(),
                updated_at=_utcnow(),
            )
        )
    await db.flush()
    loaded = await get_run(db, company_id, run.id)
    assert loaded is not None
    return loaded


async def create_corrective_work_request(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    run: PulseInspectionRun,
    item: PulseInspectionItem,
    *,
    priority: PulseWorkRequestPriority = PulseWorkRequestPriority.high,
) -> PulseWorkRequest:
    if item.work_request_id:
        existing = await db.get(PulseWorkRequest, item.work_request_id)
        if existing and existing.company_id == company_id:
            return existing

    notes_bits = [
        f"Corrective action from inspection: {run.title}.",
        f"Failed item: {item.title}.",
    ]
    if item.notes:
        notes_bits.append(f"Item notes: {item.notes}")
    if run.notes:
        notes_bits.append(f"Inspection notes: {run.notes}")
    evidence = list(item.evidence or []) + list(run.evidence or [])
    wo_num = await allocate_work_order_number(db, company_id)
    wr = PulseWorkRequest(
        id=str(uuid4()),
        company_id=company_id,
        work_order_number=wo_num,
        title=f"Corrective: {item.title}"[:255],
        description="\n\n".join(notes_bits),
        equipment_id=run.equipment_id,
        zone_id=run.zone_id,
        category="preventative",
        priority=priority,
        created_by_user_id=user_id,
        work_order_source=PulseWorkOrderSource.inspection,
        attachments=evidence,
        inspection_run_id=run.id,
        inspection_item_id=item.id,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(wr)
    await db.flush()
    item.work_request_id = wr.id
    item.updated_at = _utcnow()
    db.add(
        PulseWorkRequestActivity(
            id=str(uuid4()),
            work_request_id=wr.id,
            action="created",
            performed_by=user_id,
            meta={"source": "inspection", "inspection_run_id": run.id, "inspection_item_id": item.id},
        )
    )
    await db.flush()
    return wr


async def corrective_for_item(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    run_id: str,
    item_id: str,
) -> tuple[PulseInspectionRun, PulseWorkRequest]:
    run = await get_run(db, company_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Inspection not found")
    item = next((i for i in run.items if str(i.id) == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Inspection item not found")
    if not item_is_fail(item.result) and (run.overall_result or "").lower() not in {"fail", "failed", "unacceptable"}:
        raise HTTPException(status_code=400, detail="Item is not a failed result")
    wr = await create_corrective_work_request(db, company_id, user_id, run, item)
    loaded = await get_run(db, company_id, run.id)
    assert loaded is not None
    return loaded, wr
