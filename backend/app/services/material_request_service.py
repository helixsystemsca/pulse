"""Material request draft lifecycle."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import MaterialRequestDraft, MaterialRequestDraftItem, MaterialRequestQueue
from app.services.material_request_queue_service import QUEUE_STATUS_DRAFTED, QUEUE_STATUS_PENDING

DRAFT_STATUS_DRAFT = "draft"
DRAFT_STATUS_SUBMITTED = "submitted"
DRAFT_STATUS_CLOSED = "closed"


async def _next_draft_number(db: AsyncSession, company_id: str) -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"MR-{day}-"
    q = await db.execute(
        select(func.count())
        .select_from(MaterialRequestDraft)
        .where(
            MaterialRequestDraft.company_id == company_id,
            MaterialRequestDraft.draft_number.like(f"{prefix}%"),
        )
    )
    n = int(q.scalar_one() or 0) + 1
    return f"{prefix}{n:04d}"


def _line_estimated_cost(qty: float, unit_cost: float | None) -> float | None:
    if unit_cost is None:
        return None
    return round(float(qty) * float(unit_cost), 2)


async def create_draft_from_queue(
    db: AsyncSession,
    company_id: str,
    user_id: str | None,
    queue_item_ids: list[str],
) -> MaterialRequestDraft:
    unique_ids = list(dict.fromkeys(queue_item_ids))
    q = await db.execute(
        select(MaterialRequestQueue).where(
            MaterialRequestQueue.company_id == company_id,
            MaterialRequestQueue.id.in_(unique_ids),
            MaterialRequestQueue.status == QUEUE_STATUS_PENDING,
        )
    )
    rows = list(q.scalars().all())
    if len(rows) != len(unique_ids):
        raise HTTPException(status_code=400, detail="One or more queue items are missing or not pending")

    now = datetime.now(timezone.utc)
    draft = MaterialRequestDraft(
        id=str(uuid4()),
        company_id=company_id,
        draft_number=await _next_draft_number(db, company_id),
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
        status=DRAFT_STATUS_DRAFT,
    )
    db.add(draft)
    await db.flush()

    for row in rows:
        unit = row.estimated_unit_cost
        qty = float(row.reorder_qty)
        db.add(
            MaterialRequestDraftItem(
                id=str(uuid4()),
                draft_id=draft.id,
                queue_item_id=row.id,
                item_name=row.item_name,
                sku=row.sku,
                vendor=row.vendor,
                qty_requested=qty,
                estimated_unit_cost=unit,
                estimated_cost=_line_estimated_cost(qty, unit),
            )
        )
        row.status = QUEUE_STATUS_DRAFTED
        row.updated_at = now

    return draft


async def get_draft(db: AsyncSession, company_id: str, draft_id: str) -> MaterialRequestDraft | None:
    draft = await db.get(MaterialRequestDraft, draft_id)
    if draft is None or draft.company_id != company_id:
        return None
    return draft


async def load_draft_items(db: AsyncSession, draft_id: str) -> list[MaterialRequestDraftItem]:
    q = await db.execute(
        select(MaterialRequestDraftItem)
        .where(MaterialRequestDraftItem.draft_id == draft_id)
        .order_by(MaterialRequestDraftItem.item_name.asc())
    )
    return list(q.scalars().all())


async def submit_draft(db: AsyncSession, draft: MaterialRequestDraft) -> MaterialRequestDraft:
    if draft.status != DRAFT_STATUS_DRAFT:
        raise HTTPException(status_code=400, detail="Only draft status can be submitted")
    draft.status = DRAFT_STATUS_SUBMITTED
    draft.updated_at = datetime.now(timezone.utc)
    return draft


def draft_estimated_total(items: list[MaterialRequestDraftItem]) -> float:
    total = 0.0
    for it in items:
        if it.estimated_cost is not None:
            total += float(it.estimated_cost)
        elif it.estimated_unit_cost is not None:
            total += float(it.qty_requested) * float(it.estimated_unit_cost)
    return round(total, 2)
