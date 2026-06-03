"""Check-out / check-in for shared inventory assets."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryCheckout, InventoryItem, InventoryMovement, User


async def get_open_checkout(db: AsyncSession, item_id: str) -> InventoryCheckout | None:
    q = await db.execute(
        select(InventoryCheckout).where(
            InventoryCheckout.item_id == item_id,
            InventoryCheckout.checked_in_at.is_(None),
        )
    )
    return q.scalar_one_or_none()


async def checkout_item(
    db: AsyncSession,
    *,
    company_id: str,
    item: InventoryItem,
    user: User,
    condition_out: Optional[str] = None,
    notes: Optional[str] = None,
    zone_id: Optional[str] = None,
    expected_return_at: Optional[datetime] = None,
) -> InventoryCheckout:
    if item.item_type not in ("tool", "asset", "equipment"):
        pass  # allow all types; shared gear is often typed part/consumable in legacy data
    open_row = await get_open_checkout(db, item.id)
    if open_row is not None:
        raise ValueError("Item is already checked out")
    now = datetime.now(timezone.utc)
    movement = InventoryMovement(
        id=str(uuid4()),
        company_id=company_id,
        item_id=item.id,
        action="checkout",
        performed_by=user.id,
        zone_id=zone_id or item.zone_id,
        quantity=1.0 if item.unit == "count" else None,
        meta={"notes": notes} if notes else {},
    )
    db.add(movement)
    row = InventoryCheckout(
        id=str(uuid4()),
        company_id=company_id,
        item_id=item.id,
        checked_out_by=user.id,
        checked_out_at=now,
        expected_return_at=expected_return_at,
        condition_out=condition_out or item.item_condition,
        notes=notes,
        zone_id=zone_id or item.zone_id,
        movement_out_id=movement.id,
    )
    item.assigned_user_id = user.id
    item.last_movement_at = now
    db.add(row)
    return row


async def checkin_item(
    db: AsyncSession,
    *,
    company_id: str,
    item: InventoryItem,
    user: User,
    condition_in: Optional[str] = None,
    notes: Optional[str] = None,
) -> InventoryCheckout:
    open_row = await get_open_checkout(db, item.id)
    if open_row is None:
        raise ValueError("No open checkout for this item")
    now = datetime.now(timezone.utc)
    movement = InventoryMovement(
        id=str(uuid4()),
        company_id=company_id,
        item_id=item.id,
        action="checkin",
        performed_by=user.id,
        zone_id=open_row.zone_id or item.zone_id,
        quantity=1.0 if item.unit == "count" else None,
        meta={"notes": notes} if notes else {},
    )
    db.add(movement)
    open_row.checked_in_by = user.id
    open_row.checked_in_at = now
    open_row.condition_in = condition_in or item.item_condition
    open_row.movement_in_id = movement.id
    if notes:
        open_row.notes = (open_row.notes or "") + ("\n" if open_row.notes else "") + notes
    item.assigned_user_id = None
    if condition_in:
        item.item_condition = condition_in
    item.last_movement_at = now
    return open_row
