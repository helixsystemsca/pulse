"""Infrastructure map graph API — tenant-scoped (`/api/assets`, `/api/connections`, `/api/attributes`, `/api/trace-route`)."""

from __future__ import annotations

from collections import deque
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.domain import User
from app.models.facility_map_models import FacilityMap
from app.models.infrastructure_map_models import InfraAsset, InfraAttribute, InfraConnection
from app.models.pulse_models import PulseProject
from app.schemas.infrastructure_map import (
    InfraAssetCreateIn,
    InfraAssetOut,
    InfraAssetPatchIn,
    InfraAttributeCreateIn,
    InfraAttributeOut,
    InfraAttributeUpsertIn,
    InfraConnectionCreateIn,
    InfraConnectionOut,
    TraceRouteIn,
    TraceRouteOut,
)

router = APIRouter(tags=["infrastructure-map"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]


async def _require_pulse_project(db: AsyncSession, company_id: str, project_id: str) -> None:
    ok = (
        await db.execute(select(PulseProject.id).where(PulseProject.company_id == company_id, PulseProject.id == project_id))
    ).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


async def _require_map_in_project(db: AsyncSession, company_id: str, project_id: str, map_id: str) -> None:
    ok = (
        await db.execute(
            select(FacilityMap.id).where(
                FacilityMap.company_id == company_id,
                FacilityMap.id == map_id,
                FacilityMap.project_id == project_id,
            )
        )
    ).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found for this project")


async def _get_facility_map_row(db: AsyncSession, company_id: str, map_id: str) -> FacilityMap | None:
    q = await db.execute(select(FacilityMap).where(FacilityMap.company_id == company_id, FacilityMap.id == map_id))
    return q.scalar_one_or_none()


async def _assert_infra_entity_owned(cid: str, body: InfraAttributeCreateIn, db: AsyncSession) -> None:
    if body.entity_type == "asset":
        ok = (
            await db.execute(select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.id == body.entity_id))
        ).scalar_one_or_none()
    else:
        ok = (
            await db.execute(select(InfraConnection.id).where(InfraConnection.company_id == cid, InfraConnection.id == body.entity_id))
        ).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown entity_id")


async def _upsert_infra_attribute(
    body: InfraAttributeCreateIn,
    db: AsyncSession,
    cid: str,
) -> tuple[InfraAttributeOut, int]:
    await _assert_infra_entity_owned(cid, body, db)
    key = body.key.strip()
    existing = (
        await db.execute(
            select(InfraAttribute).where(
                InfraAttribute.company_id == cid,
                InfraAttribute.entity_type == body.entity_type,
                InfraAttribute.entity_id == body.entity_id,
                InfraAttribute.key == key,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.value = body.value
        await db.commit()
        await db.refresh(existing)
        return (
            InfraAttributeOut(
                id=existing.id,
                entity_type=existing.entity_type,  # type: ignore[arg-type]
                entity_id=existing.entity_id,
                key=existing.key,
                value=existing.value,
                created_at=existing.created_at,
            ),
            status.HTTP_200_OK,
        )
    row = InfraAttribute(
        company_id=cid,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        key=key,
        value=body.value,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return (
        InfraAttributeOut(
            id=row.id,
            entity_type=row.entity_type,  # type: ignore[arg-type]
            entity_id=row.entity_id,
            key=row.key,
            value=row.value,
            created_at=row.created_at,
        ),
        status.HTTP_201_CREATED,
    )


@router.get("/assets", response_model=list[InfraAssetOut])
async def list_assets(
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="pulse_projects.id — optional for tenant-level maps"),
    map_id: Optional[str] = Query(None, min_length=1, description="When set, only assets on this facility map"),
    system_type: Optional[str] = None,
) -> list[InfraAssetOut]:
    cid = str(user.company_id)
    q: Any
    if map_id:
        mrow = await _get_facility_map_row(db, cid, map_id)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            pid = (project_id or "").strip()
            if not pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This map belongs to a project; pass project_id",
                )
            await _require_pulse_project(db, cid, pid)
            if str(mproj) != str(pid):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found for this project")
            await _require_map_in_project(db, cid, pid, map_id)
            q = select(InfraAsset).where(InfraAsset.company_id == cid, InfraAsset.project_id == pid, InfraAsset.map_id == map_id)
        else:
            q = select(InfraAsset).where(InfraAsset.company_id == cid, InfraAsset.map_id == map_id)
    elif project_id:
        await _require_pulse_project(db, cid, project_id)
        q = select(InfraAsset).where(InfraAsset.company_id == cid, InfraAsset.project_id == project_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide map_id and/or project_id",
        )
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
            project_id=getattr(r, "project_id", None),
            map_id=getattr(r, "map_id", None),
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/assets", response_model=InfraAssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(body: InfraAssetCreateIn, db: Db, user: TenantUser) -> InfraAssetOut:
    cid = str(user.company_id)
    eff_pid: str | None = body.project_id
    eff_map = body.map_id.strip() if body.map_id and str(body.map_id).strip() else None
    if eff_map:
        mrow = await _get_facility_map_row(db, cid, eff_map)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            if not eff_pid or str(eff_pid).strip() != str(mproj):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="project_id must match the map's project",
                )
            eff_pid = str(mproj).strip()
            await _require_map_in_project(db, cid, eff_pid, eff_map)
        else:
            if eff_pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Omit project_id for tenant-level facility maps",
                )
            eff_pid = None
    elif eff_pid:
        await _require_pulse_project(db, cid, eff_pid)
        if eff_map:
            await _require_map_in_project(db, cid, eff_pid, eff_map)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide map_id and/or project_id")
    row = InfraAsset(
        company_id=cid,
        project_id=eff_pid,
        map_id=eff_map,
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
        project_id=row.project_id,
        map_id=getattr(row, "map_id", None),
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
        project_id=getattr(row, "project_id", None),
        map_id=getattr(row, "map_id", None),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/connections", response_model=list[InfraConnectionOut])
async def list_connections(
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="pulse_projects.id — optional for tenant-level maps"),
    map_id: Optional[str] = Query(None, min_length=1, description="When set, only connections on this facility map"),
    system_type: Optional[str] = None,
) -> list[InfraConnectionOut]:
    cid = str(user.company_id)
    q: Any
    if map_id:
        mrow = await _get_facility_map_row(db, cid, map_id)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            pid = (project_id or "").strip()
            if not pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This map belongs to a project; pass project_id",
                )
            await _require_pulse_project(db, cid, pid)
            if str(mproj) != str(pid):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found for this project")
            await _require_map_in_project(db, cid, pid, map_id)
            q = select(InfraConnection).where(
                InfraConnection.company_id == cid, InfraConnection.project_id == pid, InfraConnection.map_id == map_id
            )
        else:
            q = select(InfraConnection).where(InfraConnection.company_id == cid, InfraConnection.map_id == map_id)
    elif project_id:
        await _require_pulse_project(db, cid, project_id)
        q = select(InfraConnection).where(InfraConnection.company_id == cid, InfraConnection.project_id == project_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide map_id and/or project_id",
        )
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
            project_id=getattr(r, "project_id", None),
            map_id=getattr(r, "map_id", None),
            active=bool(r.active),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/connections", response_model=InfraConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(body: InfraConnectionCreateIn, db: Db, user: TenantUser) -> InfraConnectionOut:
    cid = str(user.company_id)
    eff_pid: str | None = body.project_id
    eff_map = body.map_id.strip() if body.map_id and str(body.map_id).strip() else None
    if eff_map:
        mrow = await _get_facility_map_row(db, cid, eff_map)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            if not eff_pid or str(eff_pid).strip() != str(mproj):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="project_id must match the map's project",
                )
            eff_pid = str(mproj).strip()
            await _require_map_in_project(db, cid, eff_pid, eff_map)
        else:
            if eff_pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Omit project_id for tenant-level facility maps",
                )
            eff_pid = None
    elif eff_pid:
        await _require_pulse_project(db, cid, eff_pid)
        if eff_map:
            await _require_map_in_project(db, cid, eff_pid, eff_map)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide map_id and/or project_id")
    ids = {body.from_asset_id, body.to_asset_id}
    rows = (await db.execute(select(InfraAsset).where(InfraAsset.company_id == cid, InfraAsset.id.in_(ids)))).scalars().all()
    found = {r.id for r in rows}
    if ids - found:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown asset endpoint(s)")
    for ar in rows:
        ap = getattr(ar, "project_id", None)
        amp = getattr(ar, "map_id", None)
        if ap != eff_pid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Endpoints must belong to the selected project context",
            )
        if eff_map and amp != eff_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Endpoints must belong to the selected map",
            )
        if eff_map is None and amp is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Map-scoped assets require map_id on the connection",
            )
    row = InfraConnection(
        company_id=cid,
        project_id=eff_pid,
        map_id=eff_map,
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
        project_id=row.project_id,
        map_id=getattr(row, "map_id", None),
        active=bool(row.active),
        created_at=row.created_at,
    )


@router.get("/attributes", response_model=list[InfraAttributeOut])
async def list_attributes(
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, only attributes for entities in this project"),
    map_id: Optional[str] = Query(None, min_length=1, description="When set, scope to this map (project_id required if map is project-linked)"),
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    key: Optional[str] = None,
) -> list[InfraAttributeOut]:
    cid = str(user.company_id)
    q = select(InfraAttribute).where(InfraAttribute.company_id == cid)
    if map_id:
        mrow = await _get_facility_map_row(db, cid, map_id)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            pid = (project_id or "").strip()
            if not pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This map belongs to a project; pass project_id",
                )
            await _require_pulse_project(db, cid, pid)
            if str(mproj) != str(pid):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found for this project")
            await _require_map_in_project(db, cid, pid, map_id)
            asset_scope = select(InfraAsset.id).where(
                InfraAsset.company_id == cid, InfraAsset.project_id == pid, InfraAsset.map_id == map_id
            )
            conn_scope = select(InfraConnection.id).where(
                InfraConnection.company_id == cid, InfraConnection.project_id == pid, InfraConnection.map_id == map_id
            )
        else:
            if project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Omit project_id for tenant-level facility maps",
                )
            asset_scope = select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.map_id == map_id)
            conn_scope = select(InfraConnection.id).where(InfraConnection.company_id == cid, InfraConnection.map_id == map_id)
        q = q.where(
            or_(
                and_(InfraAttribute.entity_type == "asset", InfraAttribute.entity_id.in_(asset_scope)),
                and_(InfraAttribute.entity_type == "connection", InfraAttribute.entity_id.in_(conn_scope)),
            )
        )
    elif project_id:
        await _require_pulse_project(db, cid, project_id)
        asset_scope = select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.project_id == project_id)
        conn_scope = select(InfraConnection.id).where(InfraConnection.company_id == cid, InfraConnection.project_id == project_id)
        q = q.where(
            or_(
                and_(InfraAttribute.entity_type == "asset", InfraAttribute.entity_id.in_(asset_scope)),
                and_(InfraAttribute.entity_type == "connection", InfraAttribute.entity_id.in_(conn_scope)),
            )
        )
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


@router.post("/attributes", response_model=InfraAttributeOut)
async def create_or_update_attribute(
    body: InfraAttributeCreateIn,
    response: Response,
    db: Db,
    user: TenantUser,
) -> InfraAttributeOut:
    """Insert attribute or update value when (entity_type, entity_id, key) already exists."""
    cid = str(user.company_id)
    out, code = await _upsert_infra_attribute(body, db, cid)
    response.status_code = code
    return out


@router.patch("/attributes/upsert", response_model=InfraAttributeOut)
async def upsert_attribute_patch(
    body: InfraAttributeUpsertIn,
    response: Response,
    db: Db,
    user: TenantUser,
) -> InfraAttributeOut:
    """Upsert by (entity_type, entity_id, key); same behavior as POST /attributes."""
    cid = str(user.company_id)
    out, code = await _upsert_infra_attribute(body, db, cid)
    response.status_code = code
    return out


@router.post("/trace-route", response_model=TraceRouteOut)
async def trace_route(body: TraceRouteIn, db: Db, user: TenantUser) -> TraceRouteOut:
    cid = str(user.company_id)

    def _coerce(v: Any) -> str | float | bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return float(v)
        t = str(v or "").strip()
        if t.lower() == "true":
            return True
        if t.lower() == "false":
            return False
        try:
            n = float(t)
            # preserve integer-y inputs; ok if float.
            return n
        except ValueError:
            return t

    def _rule_ok(actual: Any, operator: str, expected: Any) -> bool:
        a = _coerce(actual)
        b = expected
        op = str(operator or "").strip()
        if op == "equals":
            return str(a) == str(b)
        if op == "not_equals":
            return str(a) != str(b)
        if op == "contains":
            return str(a).lower().find(str(b).lower()) >= 0
        if op == "gt" or op == "lt":
            try:
                an = float(a)  # type: ignore[arg-type]
                bn = float(b)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                return False
            return an > bn if op == "gt" else an < bn
        return True

    filters = body.filters or []
    asset_rules = [r for r in filters if isinstance(r, dict) and r.get("entity") == "asset" and str(r.get("key") or "").strip()]
    conn_rules = [r for r in filters if isinstance(r, dict) and r.get("entity") == "connection" and str(r.get("key") or "").strip()]

    eff_pid: str | None = body.project_id
    eff_map = body.map_id
    if eff_map:
        mrow = await _get_facility_map_row(db, cid, eff_map)
        if not mrow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
        mproj = getattr(mrow, "project_id", None)
        if mproj:
            if not eff_pid or str(eff_pid).strip() != str(mproj):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="project_id must match the map's project",
                )
            eff_pid = str(mproj).strip()
            await _require_map_in_project(db, cid, eff_pid, eff_map)
        else:
            if eff_pid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Omit project_id for tenant-level facility maps",
                )
            eff_pid = None
    elif eff_pid:
        await _require_pulse_project(db, cid, eff_pid)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide map_id and/or project_id")

    ids = {body.start_asset_id, body.end_asset_id}
    ep_rows = (await db.execute(select(InfraAsset).where(InfraAsset.company_id == cid, InfraAsset.id.in_(ids)))).scalars().all()
    found = {r.id for r in ep_rows}
    if ids - found:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown start/end asset")
    for ar in ep_rows:
        ar_pid = getattr(ar, "project_id", None)
        if (ar_pid or None) != (eff_pid or None):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assets must belong to the selected project context")
        if eff_map and getattr(ar, "map_id", None) != eff_map:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assets must belong to the selected map")

    if eff_map:
        if eff_pid:
            asset_scope = select(InfraAsset.id).where(
                InfraAsset.company_id == cid, InfraAsset.project_id == eff_pid, InfraAsset.map_id == eff_map
            )
            conn_scope = select(InfraConnection.id).where(
                InfraConnection.company_id == cid,
                InfraConnection.project_id == eff_pid,
                InfraConnection.map_id == eff_map,
            )
        else:
            asset_scope = select(InfraAsset.id).where(
                InfraAsset.company_id == cid, InfraAsset.project_id.is_(None), InfraAsset.map_id == eff_map
            )
            conn_scope = select(InfraConnection.id).where(
                InfraConnection.company_id == cid,
                InfraConnection.project_id.is_(None),
                InfraConnection.map_id == eff_map,
            )
    else:
        asset_scope = select(InfraAsset.id).where(InfraAsset.company_id == cid, InfraAsset.project_id == eff_pid)
        conn_scope = select(InfraConnection.id).where(InfraConnection.company_id == cid, InfraConnection.project_id == eff_pid)
    aq = await db.execute(
        select(InfraAttribute).where(
            InfraAttribute.company_id == cid,
            or_(
                and_(InfraAttribute.entity_type == "asset", InfraAttribute.entity_id.in_(asset_scope)),
                and_(InfraAttribute.entity_type == "connection", InfraAttribute.entity_id.in_(conn_scope)),
            ),
        )
    )
    attrs = aq.scalars().all()
    attr_idx: dict[str, dict[str, Any]] = {}
    for row in attrs:
        k = f"{row.entity_type}:{row.entity_id}"
        if k not in attr_idx:
            attr_idx[k] = {}
        attr_idx[k][row.key] = row.value

    def _matches_all(entity_type: str, entity_id: str, rules: list[dict[str, Any]]) -> bool:
        if not rules:
            return True
        a = attr_idx.get(f"{entity_type}:{entity_id}", {})
        for r in rules:
            key = str(r.get("key") or "").strip()
            op = str(r.get("operator") or "equals").strip()
            expected = r.get("value")
            if not _rule_ok(a.get(key), op, expected):
                return False
        return True

    # If endpoint nodes fail asset rules, no constrained path exists.
    if asset_rules and not _matches_all("asset", body.start_asset_id, asset_rules):
        return TraceRouteOut(asset_ids=[body.start_asset_id], connection_ids=[], filtered_out_count=0, reason="No valid path under current filters")
    if asset_rules and not _matches_all("asset", body.end_asset_id, asset_rules):
        return TraceRouteOut(asset_ids=[body.start_asset_id], connection_ids=[], filtered_out_count=0, reason="No valid path under current filters")

    # Load active connections for this scope (optionally filtered by system)
    cq = select(InfraConnection).where(InfraConnection.company_id == cid, InfraConnection.active.is_(True))
    if eff_pid is not None:
        cq = cq.where(InfraConnection.project_id == eff_pid)
    else:
        cq = cq.where(InfraConnection.project_id.is_(None))
    if eff_map:
        cq = cq.where(InfraConnection.map_id == eff_map)
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
    filtered_out_count = 0
    while dq:
        cur = dq.popleft()
        if cur == goal:
            break
        for nxt, cid2 in adj.get(cur, []):
            if nxt in seen:
                continue
            if conn_rules and not _matches_all("connection", cid2, conn_rules):
                filtered_out_count += 1
                continue
            if asset_rules and not _matches_all("asset", nxt, asset_rules):
                filtered_out_count += 1
                continue
            seen.add(nxt)
            prev[nxt] = (cur, cid2)
            dq.append(nxt)

    if goal not in seen:
        return TraceRouteOut(
            asset_ids=[start],
            connection_ids=[],
            filtered_out_count=filtered_out_count,
            reason="No valid path under current filters" if filters else "No route found",
        )

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
    return TraceRouteOut(
        asset_ids=asset_path,
        connection_ids=conn_ids,
        filtered_out_count=filtered_out_count,
        reason=None,
    )

