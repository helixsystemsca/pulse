"""Quick purchase creation and inventory receive integration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    InventoryItem,
    InventoryVendor,
    PurchasingQuickPurchase,
    PurchasingQuickPurchaseLine,
    User,
)
from app.repositories import inventory_scope_repository as inv_scope_repo
from app.schemas.purchasing import QuickPurchaseCreateIn, QuickPurchaseLineIn
from app.services.inventory_transaction_service import apply_transaction_line


async def _resolve_vendor_name(
    db: AsyncSession, company_id: str, vendor_id: Optional[str], vendor_name: Optional[str]
) -> tuple[Optional[str], str]:
    if vendor_id:
        v = await db.get(InventoryVendor, vendor_id)
        if not v or v.company_id != company_id:
            raise ValueError("Unknown vendor")
        return vendor_id, v.name
    name = (vendor_name or "").strip()
    return None, name or "Unknown vendor"


async def _ensure_inventory_item_for_line(
    db: AsyncSession,
    *,
    company_id: str,
    policy,
    line: QuickPurchaseLineIn,
    vendor_name: str,
) -> InventoryItem:
    if line.inventory_item_id:
        item = await db.get(InventoryItem, line.inventory_item_id)
        if not item or item.company_id != company_id:
            raise ValueError(f"Inventory item not found for line: {line.name}")
        if not inv_scope_repo.can_write_inventory_item(policy, item):
            raise PermissionError("Inventory write denied")
        return item

    scope = await inv_scope_repo.ensure_scope_for_company_slug(db, company_id, "maintenance")
    if not policy.is_company_admin and scope.id not in policy.writable_scope_ids:
        raise PermissionError("Inventory write denied")

    sku = f"QP-{uuid4().hex[:8].upper()}"
    item = InventoryItem(
        id=str(uuid4()),
        company_id=company_id,
        scope_id=scope.id,
        sku=sku,
        name=line.name.strip(),
        quantity=0,
        unit="each",
        low_stock_threshold=0,
        item_type="consumable",
        category=line.category,
        inv_status="in_stock",
        department_slug="maintenance",
        vendor=vendor_name or None,
        unit_cost=line.unit_cost,
    )
    db.add(item)
    await db.flush()
    return item


async def create_quick_purchase(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    policy,
    body: QuickPurchaseCreateIn,
    module_settings: dict,
) -> PurchasingQuickPurchase:
    from app.core.purchasing_module_config import merge_purchasing_settings

    cfg = merge_purchasing_settings(module_settings.get("purchasing"))
    if cfg.get("require_vendor_selection") and not body.vendor_id and not (body.vendor_name or "").strip():
        raise ValueError("Vendor is required")

    vendor_id, vendor_display = await _resolve_vendor_name(db, company_id, body.vendor_id, body.vendor_name)

    purchase = PurchasingQuickPurchase(
        id=str(uuid4()),
        company_id=company_id,
        vendor_id=vendor_id,
        vendor_name=vendor_display,
        purchase_date=body.purchase_date,
        total_amount=float(body.total_amount),
        notes=(body.notes or "").strip() or None,
        add_to_inventory=bool(body.add_to_inventory),
        created_by_user_id=user.id,
    )
    db.add(purchase)
    await db.flush()

    for idx, line_in in enumerate(body.lines):
        add_inv = bool(body.add_to_inventory or line_in.add_to_inventory)
        line = PurchasingQuickPurchaseLine(
            id=str(uuid4()),
            purchase_id=purchase.id,
            name=line_in.name.strip(),
            quantity=float(line_in.quantity),
            unit_cost=line_in.unit_cost,
            category=line_in.category,
            add_to_inventory=add_inv,
            zone_id=line_in.zone_id,
            inventory_item_id=line_in.inventory_item_id,
            sort_order=idx,
        )
        if add_inv:
            item = await _ensure_inventory_item_for_line(
                db,
                company_id=company_id,
                policy=policy,
                line=line_in,
                vendor_name=vendor_display,
            )
            line.inventory_item_id = item.id
            await apply_transaction_line(
                db,
                company_id=company_id,
                user=user,
                policy=policy,
                item=item,
                transaction_type="receive",
                quantity=float(line_in.quantity),
                location_id=line_in.zone_id,
                reference=None,
                channel="purchasing_quick_purchase",
            )
        db.add(line)

    await db.flush()
    return purchase


async def vendor_purchase_stats(
    db: AsyncSession, company_id: str, vendor_ids: list[str]
) -> dict[str, dict]:
    if not vendor_ids:
        return {}
    q = (
        select(
            PurchasingQuickPurchase.vendor_id,
            func.count(PurchasingQuickPurchase.id),
            func.max(PurchasingQuickPurchase.purchase_date),
            func.avg(PurchasingQuickPurchase.total_amount),
        )
        .where(
            PurchasingQuickPurchase.company_id == company_id,
            PurchasingQuickPurchase.vendor_id.in_(vendor_ids),
        )
        .group_by(PurchasingQuickPurchase.vendor_id)
    )
    rows = (await db.execute(q)).all()
    out: dict[str, dict] = {}
    for vid, cnt, last_dt, avg_amt in rows:
        if vid:
            out[str(vid)] = {
                "total_purchases": int(cnt or 0),
                "last_purchase_date": last_dt,
                "average_purchase_value": float(avg_amt) if avg_amt is not None else None,
            }
    return out
