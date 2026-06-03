"""QR / scanner history card payload."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    InventoryCheckout,
    InventoryItem,
    InventoryMovement,
    InventoryUsage,
    InventoryVendor,
)
from app.models.pulse_models import PulseWorkRequest
from app.services.inventory_enterprise.forecasting import forecast_stockout
from app.services.inventory_enterprise.lifecycle import lifecycle_snapshot


async def build_item_history_card(db: AsyncSession, item: InventoryItem) -> dict:
    movements = list(
        (
            await db.execute(
                select(InventoryMovement)
                .where(InventoryMovement.item_id == item.id)
                .order_by(InventoryMovement.created_at.desc())
                .limit(40)
            )
        ).scalars().all()
    )
    usage = list(
        (
            await db.execute(
                select(InventoryUsage)
                .where(InventoryUsage.item_id == item.id)
                .order_by(InventoryUsage.created_at.desc())
                .limit(20)
            )
        ).scalars().all()
    )
    checkouts = list(
        (
            await db.execute(
                select(InventoryCheckout)
                .where(InventoryCheckout.item_id == item.id)
                .order_by(InventoryCheckout.checked_out_at.desc())
                .limit(20)
            )
        ).scalars().all()
    )
    vendor_name = item.vendor
    if item.vendor_id:
        v = await db.get(InventoryVendor, item.vendor_id)
        if v:
            vendor_name = v.name

    wr_ids = {str(m.work_request_id) for m in movements if m.work_request_id}
    wr_ids |= {str(u.work_request_id) for u in usage}
    wr_map: dict[str, str] = {}
    if wr_ids:
        rows = (
            await db.execute(
                select(PulseWorkRequest).where(PulseWorkRequest.id.in_(list(wr_ids)))
            )
        ).scalars().all()
        wr_map = {str(w.id): w.title for w in rows}

    open_co = next((c for c in checkouts if c.checked_in_at is None), None)
    forecast = await forecast_stockout(db, item)

    return {
        "item": {
            "id": item.id,
            "sku": item.sku,
            "name": item.name,
            "quantity": item.quantity,
            "unit": item.unit,
            "inv_status": item.inv_status,
            "condition": item.item_condition,
            "vendor": vendor_name,
            "image_url": item.image_url,
        },
        "lifecycle": lifecycle_snapshot(item),
        "forecast": forecast,
        "open_checkout": {
            "id": open_co.id,
            "checked_out_at": open_co.checked_out_at.isoformat(),
            "checked_out_by": open_co.checked_out_by,
        }
        if open_co
        else None,
        "movements": [
            {
                "id": m.id,
                "action": m.action,
                "quantity": m.quantity,
                "created_at": m.created_at.isoformat(),
                "work_request": wr_map.get(str(m.work_request_id)) if m.work_request_id else None,
                "meta": dict(m.meta or {}),
            }
            for m in movements
        ],
        "usage": [
            {
                "id": u.id,
                "quantity": u.quantity,
                "created_at": u.created_at.isoformat(),
                "work_request": wr_map.get(str(u.work_request_id)),
            }
            for u in usage
        ],
        "checkouts": [
            {
                "id": c.id,
                "checked_out_at": c.checked_out_at.isoformat(),
                "checked_in_at": c.checked_in_at.isoformat() if c.checked_in_at else None,
                "condition_out": c.condition_out,
                "condition_in": c.condition_in,
            }
            for c in checkouts
        ],
    }
