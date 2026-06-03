"""Enterprise inventory: checkout, lifecycle, forecasting, history card, location balances."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_any_rbac
from app.api.inventory_portal_routes import (
    CompanyId,
    Db,
    InvManageUser,
    InventoryPolicyDep,
    _get_inventory_item_for_company,
    _inventory_detail_payload,
)
from app.models.domain import (
    InventoryCheckout,
    InventoryItem,
    InventoryLocationBalance,
    InventoryReorderPolicy,
    InventoryVendor,
    User,
)
from app.repositories import inventory_scope_repository as inv_scope_repo
from app.schemas.inventory_enterprise import (
    InventoryCheckinIn,
    InventoryCheckoutIn,
    InventoryDisposalIn,
    InventoryHistoryCardOut,
    InventoryLifecycleIn,
    InventoryLocationBalanceIn,
    InventoryLocationBalanceOut,
    InventoryReorderPolicyIn,
)
from app.services.inventory_enterprise.checkout import checkin_item, checkout_item, get_open_checkout
from app.services.inventory_enterprise.forecasting import forecast_stockout
from app.services.inventory_enterprise.history_card import build_item_history_card
from app.services.inventory_enterprise.lifecycle import apply_disposal, lifecycle_snapshot
router = APIRouter(tags=["inventory-enterprise"])


@router.get("/{item_id}/history-card", response_model=InventoryHistoryCardOut)
async def item_history_card(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> InventoryHistoryCardOut:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    payload = await build_item_history_card(db, item)
    return InventoryHistoryCardOut(**payload)


@router.get("/{item_id}/forecast")
async def item_forecast(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    pol_q = await db.execute(
        select(InventoryReorderPolicy).where(InventoryReorderPolicy.item_id == item.id)
    )
    policy_row = pol_q.scalar_one_or_none()
    return await forecast_stockout(db, item, policy_row)


@router.get("/{item_id}/lifecycle")
async def get_lifecycle(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    return lifecycle_snapshot(item)


@router.patch("/{item_id}/lifecycle")
async def patch_lifecycle(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryLifecycleIn,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    data = body.model_dump(exclude_unset=True)
    if "vendor_id" in data and data["vendor_id"]:
        v = await db.get(InventoryVendor, data["vendor_id"])
        if not v or v.company_id != cid:
            raise HTTPException(status_code=400, detail="Unknown vendor")
        item.vendor = v.name
    for k, v in data.items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return lifecycle_snapshot(item)


@router.post("/{item_id}/dispose")
async def dispose_item(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryDisposalIn,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    apply_disposal(
        item,
        disposed_on=body.disposed_on,
        disposal_method=body.disposal_method,
        disposal_notes=body.disposal_notes,
    )
    await db.commit()
    return lifecycle_snapshot(item)


@router.post("/{item_id}/checkout")
async def checkout_inventory_item(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryCheckoutIn,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    try:
        row = await checkout_item(
            db,
            company_id=cid,
            item=item,
            user=user,
            condition_out=body.condition_out,
            notes=body.notes,
            zone_id=body.zone_id,
            expected_return_at=body.expected_return_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    return {"checkout_id": row.id, "checked_out_at": row.checked_out_at.isoformat()}


@router.post("/{item_id}/checkin")
async def checkin_inventory_item(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryCheckinIn,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    try:
        row = await checkin_item(
            db,
            company_id=cid,
            item=item,
            user=user,
            condition_in=body.condition_in,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    return {"checkout_id": row.id, "checked_in_at": row.checked_in_at.isoformat() if row.checked_in_at else None}


@router.get("/{item_id}/checkout/open")
async def open_checkout(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    row = await get_open_checkout(db, item.id)
    if not row:
        return {"open": False}
    return {
        "open": True,
        "checkout_id": row.id,
        "checked_out_by": row.checked_out_by,
        "checked_out_at": row.checked_out_at.isoformat(),
        "expected_return_at": row.expected_return_at.isoformat() if row.expected_return_at else None,
    }


@router.put("/{item_id}/reorder-policy")
async def upsert_reorder_policy(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryReorderPolicyIn,
) -> dict:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    q = await db.execute(
        select(InventoryReorderPolicy).where(InventoryReorderPolicy.item_id == item.id)
    )
    row = q.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = InventoryReorderPolicy(
            id=str(uuid4()),
            company_id=cid,
            item_id=item.id,
            updated_at=now,
        )
        db.add(row)
    row.base_low_stock_threshold = body.base_low_stock_threshold
    row.consumption_lookback_days = body.consumption_lookback_days
    row.seasonal_multipliers = body.seasonal_multipliers
    row.event_boosts = body.event_boosts
    row.updated_at = now
    await db.commit()
    return await forecast_stockout(db, item, row)


@router.get("/{item_id}/location-balances", response_model=list[InventoryLocationBalanceOut])
async def list_location_balances(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> list[InventoryLocationBalanceOut]:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    rows = (
        await db.execute(
            select(InventoryLocationBalance).where(
                InventoryLocationBalance.item_id == item.id,
                InventoryLocationBalance.company_id == cid,
            )
        )
    ).scalars().all()
    return [InventoryLocationBalanceOut(zone_id=r.zone_id, quantity=r.quantity) for r in rows]


@router.put("/{item_id}/location-balances")
async def replace_location_balances(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: list[InventoryLocationBalanceIn],
) -> list[InventoryLocationBalanceOut]:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    await db.execute(
        delete(InventoryLocationBalance).where(InventoryLocationBalance.item_id == item.id)
    )
    total = 0.0
    now = datetime.now(timezone.utc)
    out: list[InventoryLocationBalanceOut] = []
    for line in body:
        total += float(line.quantity)
        row = InventoryLocationBalance(
            id=str(uuid4()),
            company_id=cid,
            item_id=item.id,
            zone_id=line.zone_id,
            quantity=float(line.quantity),
            updated_at=now,
        )
        db.add(row)
        out.append(InventoryLocationBalanceOut(zone_id=line.zone_id, quantity=line.quantity))
    item.quantity = total
    if item.zone_id is None and body:
        item.zone_id = body[0].zone_id
    await db.commit()
    return out
