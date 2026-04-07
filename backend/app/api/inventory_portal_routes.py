"""
Advanced inventory under `/api/inventory` — items, movements, usage, work-request deduction, settings.

Multi-tenant with optional `company_id` for system administrators.
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_manager_or_above
from app.core.user_roles import user_has_any_role
from app.models.domain import (
    InventoryItem,
    InventoryModuleSettings,
    InventoryMovement,
    InventoryUsage,
    Tool,
    User,
    UserRole,
    Zone,
)
from app.models.pulse_models import PulseWorkRequest
from app.modules.pulse import service as pulse_svc
from app.schemas.inventory_portal import (
    InventoryAssignIn,
    InventoryCreateIn,
    InventoryDetailOut,
    InventoryListOut,
    InventoryMoveIn,
    InventoryMovementOut,
    InventoryPatchIn,
    InventoryRowOut,
    InventorySettingsOut,
    InventorySettingsPatchIn,
    InventorySummaryOut,
    InventoryUseIn,
    InventoryUsageOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

DEFAULT_INVENTORY_SETTINGS: dict[str, Any] = {
    "categories": ["Tool", "Part", "Consumable", "Fasteners", "Electrical"],
    "status_rules": {},
    "threshold_defaults": {"default_min": 5},
    "locations": [],
    "assignment_rules": {"checkout_required": True},
    "alerts": {"low_stock": True, "missing": True},
}


def merge_inventory_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_INVENTORY_SETTINGS)
    if not raw:
        return out
    for k, v in raw.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out


async def resolve_inv_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(status_code=400, detail="company_id is required for system administrators")
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=403, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_inv_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
MgrUser = Annotated[User, Depends(require_manager_or_above)]


def _recompute_status(item: InventoryItem) -> None:
    if item.inv_status in ("missing", "maintenance"):
        return
    if item.assigned_user_id:
        item.inv_status = "assigned"
    elif item.low_stock_threshold > 0 and item.quantity <= item.low_stock_threshold:
        item.inv_status = "low_stock"
    else:
        item.inv_status = "in_stock"


async def _log_movement(
    db: AsyncSession,
    *,
    company_id: str,
    item_id: str,
    action: str,
    performed_by: Optional[str],
    zone_id: Optional[str] = None,
    quantity: Optional[float] = None,
    work_request_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        InventoryMovement(
            id=str(uuid4()),
            company_id=company_id,
            item_id=item_id,
            action=action,
            performed_by=performed_by,
            zone_id=zone_id,
            quantity=quantity,
            work_request_id=work_request_id,
            meta=dict(meta or {}),
        )
    )


async def _ctx_maps(db: AsyncSession, cid: str) -> tuple[dict[str, User], dict[str, Zone], dict[str, Tool]]:
    uq = await db.execute(select(User).where(User.company_id == cid))
    users = {u.id: u for u in uq.scalars().all()}
    zq = await db.execute(select(Zone).where(Zone.company_id == cid))
    zones = {z.id: z for z in zq.scalars().all()}
    tq = await db.execute(select(Tool).where(Tool.company_id == cid))
    tools = {t.id: t for t in tq.scalars().all()}
    return users, zones, tools


async def _last_used_at(db: AsyncSession, item_id: str) -> Optional[datetime]:
    uq = await db.execute(
        select(func.max(InventoryUsage.created_at)).where(InventoryUsage.item_id == item_id)
    )
    umax = uq.scalar_one_or_none()
    mq = await db.execute(
        select(func.max(InventoryMovement.created_at)).where(
            InventoryMovement.item_id == item_id,
            InventoryMovement.action == "used",
        )
    )
    mmax = mq.scalar_one_or_none()
    if umax and mmax:
        return max(umax, mmax)
    return umax or mmax


def _row(
    item: InventoryItem,
    *,
    users: dict[str, User],
    zones: dict[str, Zone],
    tools: dict[str, Tool],
    last_used: Optional[datetime],
) -> InventoryRowOut:
    au = users.get(item.assigned_user_id) if item.assigned_user_id else None
    z = zones.get(item.zone_id) if item.zone_id else None
    t = tools.get(item.linked_tool_id) if item.linked_tool_id else None
    return InventoryRowOut(
        id=item.id,
        sku=item.sku,
        name=item.name,
        item_type=item.item_type,
        category=item.category,
        inv_status=item.inv_status,
        quantity=item.quantity,
        unit=item.unit,
        low_stock_threshold=item.low_stock_threshold,
        assigned_user_id=item.assigned_user_id,
        assignee_name=au.full_name if au else None,
        zone_id=item.zone_id,
        location_name=z.name if z else None,
        linked_tool_id=item.linked_tool_id,
        linked_asset_name=t.name if t else None,
        condition=item.item_condition,
        reorder_flag=item.reorder_flag,
        last_movement_at=item.last_movement_at,
        last_used_at=last_used,
        usage_count=item.usage_count,
    )


async def _get_settings_row(db: AsyncSession, cid: str) -> Optional[InventoryModuleSettings]:
    q = await db.execute(select(InventoryModuleSettings).where(InventoryModuleSettings.company_id == cid))
    return q.scalar_one_or_none()


@router.get("/settings", response_model=InventorySettingsOut)
async def get_inv_settings(db: Db, _: MgrUser, cid: CompanyId) -> InventorySettingsOut:
    row = await _get_settings_row(db, cid)
    return InventorySettingsOut(settings=merge_inventory_settings(row.settings if row else None))


@router.patch("/settings", response_model=InventorySettingsOut)
async def patch_inv_settings(
    db: Db,
    _: MgrUser,
    cid: CompanyId,
    body: InventorySettingsPatchIn,
) -> InventorySettingsOut:
    row = await _get_settings_row(db, cid)
    base = merge_inventory_settings(row.settings if row else None)
    for k, v in body.settings.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            m = dict(base[k])
            m.update(v)
            base[k] = m
        else:
            base[k] = v
    if row:
        row.settings = base
    else:
        db.add(InventoryModuleSettings(id=str(uuid4()), company_id=cid, settings=base))
    await db.commit()
    return InventorySettingsOut(settings=base)


async def _summary(db: AsyncSession, cid: str, conds: list) -> InventorySummaryOut:
    where_base = and_(InventoryItem.company_id == cid, *conds) if conds else InventoryItem.company_id == cid
    total = int(
        (await db.execute(select(func.count()).select_from(InventoryItem).where(where_base))).scalar_one() or 0
    )
    in_stock = int(
        (
            await db.execute(
                select(func.count())
                .select_from(InventoryItem)
                .where(and_(where_base, InventoryItem.inv_status == "in_stock"))
            )
        ).scalar_one()
        or 0
    )
    low_stock = int(
        (
            await db.execute(
                select(func.count())
                .select_from(InventoryItem)
                .where(and_(where_base, InventoryItem.inv_status == "low_stock"))
            )
        ).scalar_one()
        or 0
    )
    assigned = int(
        (
            await db.execute(
                select(func.count())
                .select_from(InventoryItem)
                .where(and_(where_base, InventoryItem.inv_status == "assigned"))
            )
        ).scalar_one()
        or 0
    )
    missing = int(
        (
            await db.execute(
                select(func.count())
                .select_from(InventoryItem)
                .where(and_(where_base, InventoryItem.inv_status == "missing"))
            )
        ).scalar_one()
        or 0
    )
    maint = int(
        (
            await db.execute(
                select(func.count())
                .select_from(InventoryItem)
                .where(and_(where_base, InventoryItem.inv_status == "maintenance"))
            )
        ).scalar_one()
        or 0
    )
    val_q = await db.execute(
        select(func.coalesce(func.sum(InventoryItem.quantity * func.coalesce(InventoryItem.unit_cost, 0)), 0)).where(
            where_base
        )
    )
    ev = float(val_q.scalar_one() or 0)
    return InventorySummaryOut(
        total_items=total,
        in_stock=in_stock,
        low_stock=low_stock,
        assigned=assigned,
        missing=missing,
        maintenance=maint,
        estimated_value=round(ev, 2) if ev else None,
    )


@router.get("", response_model=InventoryListOut)
async def list_inventory(
    db: Db,
    _: MgrUser,
    cid: CompanyId,
    q: Optional[str] = Query(None),
    inv_status: Optional[str] = Query(None, alias="status"),
    item_type: Optional[str] = Query(None),
    category: Optional[str] = None,
    zone_id: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> InventoryListOut:
    conds: list = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(InventoryItem.name.ilike(like), InventoryItem.sku.ilike(like), InventoryItem.category.ilike(like)))
    if inv_status:
        conds.append(InventoryItem.inv_status == inv_status)
    if item_type:
        conds.append(InventoryItem.item_type == item_type)
    if category:
        conds.append(InventoryItem.category == category)
    if zone_id:
        conds.append(InventoryItem.zone_id == zone_id)
    if assigned_user_id:
        conds.append(InventoryItem.assigned_user_id == assigned_user_id)
    if date_from:
        conds.append(InventoryItem.last_movement_at.isnot(None))
        conds.append(InventoryItem.last_movement_at >= date_from)
    if date_to:
        conds.append(InventoryItem.last_movement_at.isnot(None))
        conds.append(InventoryItem.last_movement_at <= date_to)

    where_clause = and_(InventoryItem.company_id == cid, *conds) if conds else InventoryItem.company_id == cid

    total = int(
        (await db.execute(select(func.count()).select_from(InventoryItem).where(where_clause))).scalar_one() or 0
    )
    summ = await _summary(db, cid, conds)

    stmt = (
        select(InventoryItem)
        .where(where_clause)
        .order_by(InventoryItem.name.asc())
        .offset(offset)
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    users, zones, tools = await _ctx_maps(db, cid)
    items: list[InventoryRowOut] = []
    for it in rows:
        lu = await _last_used_at(db, it.id)
        items.append(_row(it, users=users, zones=zones, tools=tools, last_used=lu))

    return InventoryListOut(items=items, total=total, summary=summ)


@router.get("/{item_id}", response_model=InventoryDetailOut)
async def get_inventory_item(db: Db, _: MgrUser, cid: CompanyId, item_id: str) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    users, zones, tools = await _ctx_maps(db, cid)
    lu = await _last_used_at(db, item.id)
    base = _row(item, users=users, zones=zones, tools=tools, last_used=lu)

    mq = await db.execute(
        select(InventoryMovement)
        .where(InventoryMovement.item_id == item_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(80)
    )
    movements: list[InventoryMovementOut] = []
    wr_ids: set[str] = set()
    for m in mq.scalars().all():
        pu = users.get(m.performed_by) if m.performed_by else None
        zn = zones.get(m.zone_id).name if m.zone_id and m.zone_id in zones else None
        wlabel = None
        if m.work_request_id:
            wr_ids.add(m.work_request_id)
            wq = await db.get(PulseWorkRequest, m.work_request_id)
            wlabel = wq.title[:80] if wq else None
        movements.append(
            InventoryMovementOut(
                id=m.id,
                action=m.action,
                performed_by=m.performed_by,
                performer_name=pu.full_name if pu else None,
                zone_id=m.zone_id,
                zone_name=zn,
                quantity=m.quantity,
                work_request_id=m.work_request_id,
                work_request_label=wlabel,
                meta=dict(m.meta or {}),
                created_at=m.created_at,
            )
        )

    uq = await db.execute(
        select(InventoryUsage)
        .where(InventoryUsage.item_id == item_id)
        .order_by(InventoryUsage.created_at.desc())
        .limit(50)
    )
    usage_out: list[InventoryUsageOut] = []
    for u in uq.scalars().all():
        wr_ids.add(u.work_request_id)
        wq = await db.get(PulseWorkRequest, u.work_request_id)
        usage_out.append(
            InventoryUsageOut(
                id=u.id,
                work_request_id=u.work_request_id,
                work_request_title=wq.title if wq else None,
                quantity=u.quantity,
                created_at=u.created_at,
            )
        )

    linked_wr: list[dict[str, str]] = []
    for wid in wr_ids:
        w = await db.get(PulseWorkRequest, wid)
        if w and w.company_id == cid:
            linked_wr.append({"id": w.id, "title": w.title})

    return InventoryDetailOut(
        **base.model_dump(),
        unit_cost=item.unit_cost,
        movements=movements,
        usage=usage_out,
        linked_work_requests=linked_wr,
    )


@router.post("", response_model=InventoryDetailOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    body: InventoryCreateIn,
) -> InventoryDetailOut:
    sku = (body.sku or "").strip() or f"INV-{uuid4().hex[:8].upper()}"
    if body.zone_id and not await pulse_svc.zone_in_company(db, cid, body.zone_id):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if body.assigned_user_id and not await pulse_svc._user_in_company(db, cid, body.assigned_user_id):
        raise HTTPException(status_code=400, detail="Unknown assignee")
    if body.linked_tool_id and not await pulse_svc.tool_in_company(db, cid, body.linked_tool_id):
        raise HTTPException(status_code=400, detail="Unknown linked asset")
    exists = await db.execute(
        select(InventoryItem.id).where(InventoryItem.company_id == cid, InventoryItem.sku == sku)
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    inv_st = body.inv_status
    item = InventoryItem(
        id=str(uuid4()),
        company_id=cid,
        sku=sku,
        name=body.name.strip(),
        quantity=float(body.quantity),
        unit=body.unit,
        low_stock_threshold=float(body.low_stock_threshold),
        item_type=body.item_type,
        category=body.category,
        inv_status=inv_st or "in_stock",
        zone_id=body.zone_id,
        assigned_user_id=body.assigned_user_id,
        linked_tool_id=body.linked_tool_id,
        item_condition=body.condition,
        reorder_flag=body.reorder_flag,
        unit_cost=body.unit_cost,
    )
    if body.assigned_user_id:
        item.inv_status = "assigned"
    elif not inv_st:
        _recompute_status(item)
    now = datetime.now(timezone.utc)
    item.last_movement_at = now
    db.add(item)
    await db.flush()
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="created",
        performed_by=user.id,
        zone_id=item.zone_id,
        meta={"name": item.name},
    )
    await db.commit()
    await db.refresh(item)
    return await get_inventory_item(db, user, cid, item.id)


@router.patch("/{item_id}", response_model=InventoryDetailOut)
async def patch_inventory_item(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    item_id: str,
    body: InventoryPatchIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "zone_id" in data and data["zone_id"] and not await pulse_svc.zone_in_company(db, cid, data["zone_id"]):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if "assigned_user_id" in data and data["assigned_user_id"]:
        if not await pulse_svc._user_in_company(db, cid, data["assigned_user_id"]):
            raise HTTPException(status_code=400, detail="Unknown assignee")
    if "linked_tool_id" in data and data["linked_tool_id"]:
        if not await pulse_svc.tool_in_company(db, cid, data["linked_tool_id"]):
            raise HTTPException(status_code=400, detail="Unknown linked asset")

    cond = data.pop("condition", None)
    if cond is not None:
        item.item_condition = cond
    for k in (
        "name",
        "item_type",
        "category",
        "quantity",
        "unit",
        "low_stock_threshold",
        "inv_status",
        "zone_id",
        "assigned_user_id",
        "linked_tool_id",
        "unit_cost",
        "reorder_flag",
    ):
        if k in data and data[k] is not None:
            setattr(item, k, data[k])
    if "inv_status" not in data:
        _recompute_status(item)
    item.last_movement_at = datetime.now(timezone.utc)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="updated",
        performed_by=user.id,
        meta={"fields": list(body.model_dump(exclude_unset=True).keys())},
    )
    await db.commit()
    await db.refresh(item)
    return await get_inventory_item(db, user, cid, item_id)


@router.post("/{item_id}/assign", response_model=InventoryDetailOut)
async def assign_inventory(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    item_id: str,
    body: InventoryAssignIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    uid = body.user_id
    if uid and not await pulse_svc._user_in_company(db, cid, uid):
        raise HTTPException(status_code=400, detail="Unknown assignee")
    item.assigned_user_id = uid
    if uid:
        item.inv_status = "assigned"
    else:
        _recompute_status(item)
    item.last_movement_at = datetime.now(timezone.utc)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="assigned" if uid else "returned",
        performed_by=user.id,
        quantity=1.0 if item.item_type == "tool" else item.quantity,
        meta={"user_id": uid},
    )
    await db.commit()
    return await get_inventory_item(db, user, cid, item_id)


@router.post("/{item_id}/move", response_model=InventoryDetailOut)
async def move_inventory(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    item_id: str,
    body: InventoryMoveIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    zid = body.zone_id
    if zid and not await pulse_svc.zone_in_company(db, cid, zid):
        raise HTTPException(status_code=400, detail="Unknown zone")
    item.zone_id = zid
    item.last_movement_at = datetime.now(timezone.utc)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="moved",
        performed_by=user.id,
        zone_id=zid,
        meta={},
    )
    await db.commit()
    return await get_inventory_item(db, user, cid, item_id)


@router.post("/{item_id}/use", response_model=InventoryDetailOut)
async def use_inventory(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    item_id: str,
    body: InventoryUseIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    wr = await db.get(PulseWorkRequest, body.work_request_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=400, detail="Unknown work request")
    qty = float(body.quantity)
    if item.item_type in ("part", "consumable"):
        if item.quantity < qty:
            raise HTTPException(status_code=400, detail="Insufficient quantity")
        item.quantity -= qty
        item.usage_count += int(qty) if item.unit == "count" else int(qty)
    else:
        item.usage_count += 1

    db.add(
        InventoryUsage(
            id=str(uuid4()),
            company_id=cid,
            item_id=item.id,
            work_request_id=wr.id,
            quantity=qty,
        )
    )
    item.last_movement_at = datetime.now(timezone.utc)
    _recompute_status(item)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="used",
        performed_by=user.id,
        quantity=qty,
        work_request_id=wr.id,
        meta={"work_request_title": wr.title},
    )
    await db.commit()
    return await get_inventory_item(db, user, cid, item_id)
