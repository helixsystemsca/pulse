"""Low-stock material request queue automation and maintenance."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, MaterialRequestQueue

QUEUE_STATUS_PENDING = "pending"
QUEUE_STATUS_DRAFTED = "drafted"
QUEUE_STATUS_SUBMITTED = "submitted"
QUEUE_STATUS_ORDERED = "ordered"
QUEUE_STATUS_RECEIVED = "received"
QUEUE_STATUS_EXPORTED = "exported"


def compute_reorder_qty(item: InventoryItem) -> float:
    current = float(item.quantity or 0)
    minimum = float(item.low_stock_threshold or 0)
    maximum = float(item.maximum_qty) if item.maximum_qty is not None else None
    if maximum is not None and maximum > current:
        return max(0.0, maximum - current)
    if minimum > 0:
        return minimum * 2.0
    return 1.0


def _snapshot_from_item(item: InventoryItem) -> dict:
    attrs = item.custom_attributes or {}
    vendor_part = attrs.get("vendor_part_number") or attrs.get("vendorPartNumber")
    if vendor_part is not None:
        vendor_part = str(vendor_part).strip() or None
    return {
        "item_name": item.name,
        "sku": item.sku,
        "category": item.category,
        "vendor": item.vendor,
        "vendor_part_number": vendor_part or item.sku,
        "unit": item.unit,
        "current_qty": float(item.quantity or 0),
        "minimum_qty": float(item.low_stock_threshold or 0),
        "maximum_qty": float(item.maximum_qty) if item.maximum_qty is not None else None,
        "reorder_qty": compute_reorder_qty(item),
        "estimated_unit_cost": float(item.unit_cost) if item.unit_cost is not None else None,
    }


def is_item_low_stock(item: InventoryItem) -> bool:
    minimum = float(item.low_stock_threshold or 0)
    if minimum <= 0:
        return False
    return float(item.quantity or 0) <= minimum


async def sync_queue_for_inventory_item(db: AsyncSession, item: InventoryItem) -> bool:
    """
    Enqueue or refresh a pending row when stock is at/below minimum; drop pending when above.
    Returns True when a new pending queue row was created (first entry this low stint).
    """
    if not is_item_low_stock(item):
        q = await db.execute(
            select(MaterialRequestQueue).where(
                MaterialRequestQueue.company_id == item.company_id,
                MaterialRequestQueue.inventory_item_id == item.id,
                MaterialRequestQueue.status == QUEUE_STATUS_PENDING,
            )
        )
        pending = q.scalar_one_or_none()
        if pending is not None:
            await db.delete(pending)
        return False

    snap = _snapshot_from_item(item)
    q = await db.execute(
        select(MaterialRequestQueue).where(
            MaterialRequestQueue.company_id == item.company_id,
            MaterialRequestQueue.inventory_item_id == item.id,
            MaterialRequestQueue.status == QUEUE_STATUS_PENDING,
        )
    )
    row = q.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    created = False
    if row is None:
        db.add(
            MaterialRequestQueue(
                company_id=item.company_id,
                inventory_item_id=item.id,
                status=QUEUE_STATUS_PENDING,
                created_at=now,
                updated_at=now,
                **snap,
            )
        )
        created = True
    else:
        for k, v in snap.items():
            setattr(row, k, v)
        row.updated_at = now
    return created


async def list_pending_queue(db: AsyncSession, company_id: str) -> list[MaterialRequestQueue]:
    q = await db.execute(
        select(MaterialRequestQueue)
        .where(
            MaterialRequestQueue.company_id == company_id,
            MaterialRequestQueue.status == QUEUE_STATUS_PENDING,
        )
        .order_by(MaterialRequestQueue.created_at.asc())
    )
    return list(q.scalars().all())


async def get_queue_row(db: AsyncSession, company_id: str, queue_id: str) -> MaterialRequestQueue | None:
    row = await db.get(MaterialRequestQueue, queue_id)
    if row is None or row.company_id != company_id:
        return None
    return row


async def remove_from_queue(db: AsyncSession, row: MaterialRequestQueue) -> None:
    await db.delete(row)


async def patch_queue_reorder_qty(
    db: AsyncSession, row: MaterialRequestQueue, reorder_qty: float
) -> MaterialRequestQueue:
    row.reorder_qty = max(0.0, float(reorder_qty))
    row.updated_at = datetime.now(timezone.utc)
    return row


async def patch_queue_item(
    db: AsyncSession,
    row: MaterialRequestQueue,
    *,
    reorder_qty: float | None = None,
    reimbursable: bool | None = None,
    vendor_part_number: str | None = None,
    unit: str | None = None,
) -> MaterialRequestQueue:
    if reorder_qty is not None:
        row.reorder_qty = max(0.0, float(reorder_qty))
    if reimbursable is not None:
        row.reimbursable = reimbursable
    if vendor_part_number is not None:
        row.vendor_part_number = vendor_part_number.strip() or None
    if unit is not None:
        row.unit = unit.strip() or None
    row.updated_at = datetime.now(timezone.utc)
    return row


async def get_queue_rows_for_export(
    db: AsyncSession, company_id: str, queue_item_ids: list[str]
) -> list[MaterialRequestQueue]:
    q = await db.execute(
        select(MaterialRequestQueue).where(
            MaterialRequestQueue.company_id == company_id,
            MaterialRequestQueue.id.in_(queue_item_ids),
            MaterialRequestQueue.status == QUEUE_STATUS_PENDING,
        )
    )
    rows = list(q.scalars().all())
    rows.sort(key=lambda r: queue_item_ids.index(r.id))
    return rows
