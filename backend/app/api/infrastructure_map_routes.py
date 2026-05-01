"""Infrastructure map graph API — tenant-scoped (`/api/assets`, `/api/connections`, `/api/attributes`, `/api/trace-route`)."""

from __future__ import annotations

from collections import deque
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.domain import User
from app.models.infrastructure_map_models import InfraAsset, InfraAttribute, InfraConnection
from app.schemas.infrastructure_map import (
    InfraAssetCreateIn,
    InfraAssetOut,
    InfraAssetPatchIn,
    InfraAttributeCreateIn,
    InfraAttributeOut,
    InfraConnectionCreateIn,
    InfraConnectionOut,
    TraceRouteIn,
    TraceRouteOut,
)

router = APIRouter(tags=["infrastructure-map"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]


@router.get("/assets", response_model=list[InfraAssetOut])
async def list_assets(db: Db, user: TenantUser, system_type: Optional[str] = None) -> list[InfraAssetOut]:
    cid = str(user.company_id)
    q = select(InfraAsset).where(InfraAsset.company_id == cid)
    if system_type:
        q = q.where(InfraAsset.system_type == system_type)
    rows = (await db.execute(q.order_by(InfraAsset.created_at.desc()))).scalars().all()
    return [
        InfraAssetOut(
            id=r.id,
            name=r.name,
            type=r.asset_type,
            system_type=r.system_type,  # type: ignore[arg-type]
            x=r.x,
            y=r.y,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/assets", response_model=InfraAssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(body: InfraAssetCreateIn, db: Db, user: TenantUser) -> InfraAssetOut:
    cid = str(user.company_id)
    row = InfraAsset(
        company_id=cid,
        name=body.name.strip(),
        asset_type=body.type.strip(),
        system_type=body.system_type,
        x=float(body.x),
        y=float(body.y),
        notes=body.notes,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return InfraAssetOut(
        id=row.id,
        name=row.name,
        type=row.asset_type,
        system_type=row.system_type,  # type: ignore[arg-type]
        x=row.x,
        y=row.y,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.patch("/assets/{asset_id}", response_model=InfraAssetOut)
async def patch_asset(asset_id: str, body: InfraAssetPatchIn, db: Db, user: TenantUser) -> InfraAssetOut:
    cid = str(user.company_id)
    row = (await db.execute(select(InfraAsset).where(InfraAsset.id == asset_id, InfraAsset.company_id == cid))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if body.name is not None:
        row.name = body.name.strip()
    if body.type is not None:
        row.asset_type = body.type.strip()
    if body.system_type is not None:
        row.system_type = body.system_type
    if body.x is not None:
        row.x = float(body.x)
    if body.y is not None:
        row.y = float(body.y)
    if body.notes is not None:
        row.notes = body.notes
    await db.commit()
    await db.refresh(row)
    return InfraAssetOut(
        id=row.id,
        name=row.name,
        type=row.asset_type,
        system_type=row.system_type,  # type: ignore[arg-type]
        x=row.x,
        y=row.y,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/connections", response_model=list[InfraConnectionOut])
async def list_connections(db: Db, user: TenantUser, system_type: Optional[str] = None) -> list[InfraConnectionOut]:
    cid = str(user.company_id)
    q = select(InfraConnection).where(InfraConnection.company_id == cid)
    if system_type:
        q = q.where(InfraConnection.system_type == system_type)
    rows = (await db.execute(q.order_by(InfraConnection.created_at.desc()))).scalars().all()
    return [
        InfraConnectionOut(
            id=r.id,
            from_asset_id=r.from_asset_id,
            to_asset_id=r.to_asset_id,
            system_type=r.system_type,  # type: ignore[arg-type]
            connection_type=r.connection_type,
            active=bool(r.active),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/connections", response_model=InfraConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(body: InfraConnectionCreateIn, db: Db, user: TenantUser) -> InfraConnectionOut:
    cid = str(user.company_id)
    # Validate endpoints exist in-company
    ids = {body.from_asset_id, body.to_asset_id}
    q = await db.execute(select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.id.in_(ids)))
    found = set(q.scalars().all())
    if ids - found:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown asset endpoint(s)")
    row = InfraConnection(
        company_id=cid,
        from_asset_id=body.from_asset_id,
        to_asset_id=body.to_asset_id,
        system_type=body.system_type,
        connection_type=body.connection_type.strip(),
        active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return InfraConnectionOut(
        id=row.id,
        from_asset_id=row.from_asset_id,
        to_asset_id=row.to_asset_id,
        system_type=row.system_type,  # type: ignore[arg-type]
        connection_type=row.connection_type,
        active=bool(row.active),
        created_at=row.created_at,
    )


@router.get("/attributes", response_model=list[InfraAttributeOut])
async def list_attributes(
    db: Db,
    user: TenantUser,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    key: Optional[str] = None,
) -> list[InfraAttributeOut]:
    cid = str(user.company_id)
    q = select(InfraAttribute).where(InfraAttribute.company_id == cid)
    if entity_type:
        q = q.where(InfraAttribute.entity_type == entity_type)
    if entity_id:
        q = q.where(InfraAttribute.entity_id == entity_id)
    if key:
        q = q.where(InfraAttribute.key == key)
    rows = (await db.execute(q.order_by(InfraAttribute.created_at.desc()))).scalars().all()
    return [
        InfraAttributeOut(
            id=r.id,
            entity_type=r.entity_type,  # type: ignore[arg-type]
            entity_id=r.entity_id,
            key=r.key,
            value=r.value,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/attributes", response_model=InfraAttributeOut, status_code=status.HTTP_201_CREATED)
async def create_attribute(body: InfraAttributeCreateIn, db: Db, user: TenantUser) -> InfraAttributeOut:
    cid = str(user.company_id)
    # Basic tenant ownership check: entity must belong to this tenant
    if body.entity_type == "asset":
        ok = (await db.execute(select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.id == body.entity_id))).scalar_one_or_none()
    else:
        ok = (await db.execute(select(InfraConnection.id).where(InfraConnection.company_id == cid, InfraConnection.id == body.entity_id))).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown entity_id")
    row = InfraAttribute(
        company_id=cid,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        key=body.key.strip(),
        value=body.value,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return InfraAttributeOut(
        id=row.id,
        entity_type=row.entity_type,  # type: ignore[arg-type]
        entity_id=row.entity_id,
        key=row.key,
        value=row.value,
        created_at=row.created_at,
    )


@router.post("/trace-route", response_model=TraceRouteOut)
async def trace_route(body: TraceRouteIn, db: Db, user: TenantUser) -> TraceRouteOut:
    cid = str(user.company_id)

    # Ensure endpoints exist
    ids = {body.start_asset_id, body.end_asset_id}
    q = await db.execute(select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.id.in_(ids)))
    found = set(q.scalars().all())
    if ids - found:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown start/end asset")

    # Load active connections (optionally scoped to a system)
    cq = select(InfraConnection).where(InfraConnection.company_id == cid, InfraConnection.active.is_(True))
    if body.system_type:
        cq = cq.where(InfraConnection.system_type == body.system_type)
    conns = (await db.execute(cq)).scalars().all()

    # Build adjacency list with connection ids
    adj: dict[str, list[tuple[str, str]]] = {}
    for c in conns:
        a = c.from_asset_id
        b = c.to_asset_id
        adj.setdefault(a, []).append((b, c.id))
        adj.setdefault(b, []).append((a, c.id))

    start = body.start_asset_id
    goal = body.end_asset_id

    # BFS over assets, tracking predecessor (asset, via_conn)
    prev: dict[str, tuple[str, str]] = {}
    seen = {start}
    dq: deque[str] = deque([start])
    while dq:
        cur = dq.popleft()
        if cur == goal:
            break
        for nxt, cid2 in adj.get(cur, []):
            if nxt in seen:
                continue
            seen.add(nxt)
            prev[nxt] = (cur, cid2)
            dq.append(nxt)

    if goal not in seen:
        return TraceRouteOut(asset_ids=[start], connection_ids=[])

    # Reconstruct ordered path
    asset_path: list[str] = [goal]
    conn_path_rev: list[str] = []
    cur = goal
    while cur != start:
        p, via = prev[cur]
        conn_path_rev.append(via)
        asset_path.append(p)
        cur = p
    asset_path.reverse()
    conn_ids = list(reversed(conn_path_rev))
    return TraceRouteOut(asset_ids=asset_path, connection_ids=conn_ids)

