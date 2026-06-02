"""Batched inventory list/detail queries (avoids per-row round trips)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryMovement, InventoryUsage, Tool, User, Zone


async def last_used_at_map(db: AsyncSession, item_ids: list[str]) -> dict[str, datetime]:
    if not item_ids:
        return {}
    usage_rows = (
        await db.execute(
            select(InventoryUsage.item_id, func.max(InventoryUsage.created_at).label("ts"))
            .where(InventoryUsage.item_id.in_(item_ids))
            .group_by(InventoryUsage.item_id)
        )
    ).all()
    move_rows = (
        await db.execute(
            select(InventoryMovement.item_id, func.max(InventoryMovement.created_at).label("ts"))
            .where(
                InventoryMovement.item_id.in_(item_ids),
                InventoryMovement.action == "used",
            )
            .group_by(InventoryMovement.item_id)
        )
    ).all()
    out: dict[str, datetime] = {}
    for item_id, ts in usage_rows:
        if ts is not None:
            out[str(item_id)] = ts
    for item_id, ts in move_rows:
        if ts is None:
            continue
        key = str(item_id)
        prev = out.get(key)
        out[key] = max(prev, ts) if prev else ts
    return out


async def ctx_maps_for_ids(
    db: AsyncSession,
    cid: str,
    *,
    user_ids: set[str],
    zone_ids: set[str],
    tool_ids: set[str],
) -> tuple[dict[str, User], dict[str, Zone], dict[str, Tool]]:
    users: dict[str, User] = {}
    zones: dict[str, Zone] = {}
    tools: dict[str, Tool] = {}
    if user_ids:
        uq = await db.execute(
            select(User).where(User.company_id == cid, User.id.in_(list(user_ids))),
        )
        users = {str(u.id): u for u in uq.scalars().all()}
    if zone_ids:
        zq = await db.execute(
            select(Zone).where(Zone.company_id == cid, Zone.id.in_(list(zone_ids))),
        )
        zones = {str(z.id): z for z in zq.scalars().all()}
    if tool_ids:
        tq = await db.execute(
            select(Tool).where(Tool.company_id == cid, Tool.id.in_(list(tool_ids))),
        )
        tools = {str(t.id): t for t in tq.scalars().all()}
    return users, zones, tools


def collect_item_reference_ids(
    items: list,
    *,
    extra_user_ids: set[str] | None = None,
    extra_zone_ids: set[str] | None = None,
    extra_tool_ids: set[str] | None = None,
) -> tuple[set[str], set[str], set[str]]:
    user_ids = set(extra_user_ids or ())
    zone_ids = set(extra_zone_ids or ())
    tool_ids = set(extra_tool_ids or ())
    for it in items:
        if getattr(it, "assigned_user_id", None):
            user_ids.add(str(it.assigned_user_id))
        if getattr(it, "zone_id", None):
            zone_ids.add(str(it.zone_id))
        if getattr(it, "linked_tool_id", None):
            tool_ids.add(str(it.linked_tool_id))
        attrs = getattr(it, "custom_attributes", None) or {}
        stock = attrs.get("location_stock")
        if isinstance(stock, list):
            for entry in stock:
                if isinstance(entry, dict) and entry.get("zone_id"):
                    zone_ids.add(str(entry["zone_id"]))
    return user_ids, zone_ids, tool_ids
