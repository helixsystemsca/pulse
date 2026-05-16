"""Inventory module routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_any_rbac, require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.inventory.policy import resolve_effective_inventory_policy
from app.models.domain import InventoryItem, User
from app.modules.inventory import MODULE_KEY
from app.modules.inventory.schemas import InventoryItemCreate, StockAdjust
from app.repositories import inventory_scope_repository as inv_scope_repo

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/items")
async def list_items(
    user: Annotated[User, Depends(require_any_rbac("inventory.view", "inventory.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    cid = str(user.company_id)
    policy = await resolve_effective_inventory_policy(db, user, cid)
    stmt = select(InventoryItem).where(InventoryItem.company_id == user.company_id)
    stmt = inv_scope_repo.apply_inventory_scope_filter(stmt, InventoryItem.scope_id, policy)
    q = await db.execute(stmt.order_by(InventoryItem.name))
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "sku": r.sku,
            "name": r.name,
            "quantity": r.quantity,
            "unit": r.unit,
            "low_stock_threshold": r.low_stock_threshold,
            "usage_count": r.usage_count,
            "low_stock": r.quantity <= r.low_stock_threshold,
            "scope_id": r.scope_id,
        }
        for r in rows
    ]


@router.post("/items")
async def create_item(
    body: InventoryItemCreate,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    cid = str(user.company_id)
    policy = await resolve_effective_inventory_policy(db, user, cid)
    scope_row = await inv_scope_repo.ensure_scope_for_company_slug(db, cid, "maintenance")
    if not policy.is_company_admin and scope_row.id not in policy.writable_scope_ids:
        raise HTTPException(status_code=403, detail="Inventory write denied")
    row = InventoryItem(
        company_id=user.company_id,
        scope_id=scope_row.id,
        sku=body.sku,
        name=body.name,
        quantity=body.quantity,
        unit=body.unit,
        low_stock_threshold=body.low_stock_threshold,
        department_slug=scope_row.slug[:64],
    )
    db.add(row)
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="inventory.item_created",
            company_id=user.company_id,
            entity_id=row.id,
            metadata={"item_id": row.id, "sku": row.sku},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"id": row.id}


@router.post("/items/{item_id}/adjust")
async def adjust_stock(
    item_id: str,
    body: StockAdjust,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    cid = str(user.company_id)
    policy = await resolve_effective_inventory_policy(db, user, cid)
    q = await db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.company_id == user.company_id)
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    if not inv_scope_repo.can_write_inventory_item(policy, row):
        raise HTTPException(status_code=403, detail="Inventory write denied")
    row.quantity += body.delta
    if body.delta < 0:
        row.usage_count += int(abs(body.delta)) if row.unit == "count" else 1
    await db.flush()
    low = row.quantity <= row.low_stock_threshold
    await event_engine.publish(
        DomainEvent(
            event_type="inventory.adjusted",
            company_id=user.company_id,
            entity_id=row.id,
            metadata={
                "item_id": row.id,
                "delta": body.delta,
                "quantity": row.quantity,
                "low_stock": low,
                "reason": body.reason,
            },
            source_module=MODULE_KEY,
        )
    )
    if low:
        await event_engine.publish(
            DomainEvent(
                event_type="inventory.low_stock",
                company_id=user.company_id,
                entity_id=row.id,
                metadata={"item_id": row.id, "sku": row.sku, "quantity": row.quantity},
                source_module=MODULE_KEY,
            )
        )
    await db.commit()
    return {"id": row.id, "quantity": row.quantity, "low_stock": low}
