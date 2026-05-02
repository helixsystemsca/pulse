"""Facility maps — `/api/maps`. Tenant-scoped drawings (image + overlay elements)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.domain import User
from app.models.facility_map_models import FacilityMap
from app.models.pulse_models import PulseProject
from app.schemas.blueprint import (
    default_blueprint_layers,
    layers_model_to_json,
    parse_layers_json,
    parse_tasks_json,
    tasks_model_to_json,
)
from app.schemas.facility_map import (
    MapCreateIn,
    MapDetailOut,
    MapSummaryOut,
    MapUpdateIn,
    parse_elements_json,
    serialize_elements_json,
)
from app.services.onboarding_service import sync_user_onboarding_from_reality

router = APIRouter(prefix="/maps", tags=["maps"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]
async def _get_map(db: AsyncSession, company_id: str, map_id: str) -> FacilityMap | None:
    q = await db.execute(select(FacilityMap).where(FacilityMap.id == map_id, FacilityMap.company_id == company_id))
    return q.scalar_one_or_none()


async def _require_project(db: AsyncSession, company_id: str, project_id: str) -> None:
    ok = (
        await db.execute(select(PulseProject.id).where(PulseProject.company_id == company_id, PulseProject.id == project_id))
    ).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


def _row_to_detail(row: FacilityMap) -> MapDetailOut:
    raw_layers = parse_layers_json(getattr(row, "layers_json", None))
    layers = raw_layers if raw_layers else default_blueprint_layers()
    return MapDetailOut(
        id=row.id,
        name=row.name,
        project_id=getattr(row, "project_id", None),
        category=row.category or "General",
        created_at=row.created_at,
        updated_at=row.updated_at,
        image_url=row.image_url or "",
        elements=parse_elements_json(getattr(row, "elements_json", None)),
        tasks=parse_tasks_json(getattr(row, "tasks_json", None)),
        layers=layers,
    )


@router.get("", response_model=list[MapSummaryOut])
async def list_maps(
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, only maps for this project"),
) -> list[MapSummaryOut]:
    cid = str(user.company_id)
    filt = [FacilityMap.company_id == cid]
    if project_id:
        await _require_project(db, cid, project_id)
        filt.append(FacilityMap.project_id == project_id)
    q = await db.execute(select(FacilityMap).where(*filt).order_by(FacilityMap.category, FacilityMap.name, FacilityMap.created_at.desc()))
    rows = q.scalars().all()
    return [
        MapSummaryOut(
            id=r.id,
            name=r.name,
            project_id=getattr(r, "project_id", None),
            category=(r.category or "General")[:128],
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("", response_model=MapDetailOut, status_code=status.HTTP_201_CREATED)
async def create_map(body: MapCreateIn, db: Db, user: TenantUser) -> MapDetailOut:
    cid = str(user.company_id)
    raw_pid = body.project_id.strip() if body.project_id and str(body.project_id).strip() else None
    if raw_pid:
        await _require_project(db, cid, raw_pid)
    cat = body.category.strip() if body.category else "General"
    layers = body.layers if body.layers else default_blueprint_layers()
    row = FacilityMap(
        company_id=cid,
        name=body.name.strip(),
        project_id=raw_pid,
        category=cat[:128],
        image_url=body.image_url or "",
        elements_json=serialize_elements_json(body.elements),
        tasks_json=tasks_model_to_json(body.tasks),
        layers_json=layers_model_to_json(layers),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)
    return _row_to_detail(row)


@router.get("/{map_id}", response_model=MapDetailOut)
async def get_map(
    map_id: str,
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, map must belong to this project"),
) -> MapDetailOut:
    cid = str(user.company_id)
    row = await _get_map(db, cid, map_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    if project_id:
        await _require_project(db, cid, project_id)
        if getattr(row, "project_id", None) != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    return _row_to_detail(row)


@router.put("/{map_id}", response_model=MapDetailOut)
async def update_map(
    map_id: str,
    body: MapUpdateIn,
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, map must belong to this project"),
) -> MapDetailOut:
    cid = str(user.company_id)
    row = await _get_map(db, cid, map_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    if project_id:
        await _require_project(db, cid, project_id)
        if getattr(row, "project_id", None) != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    row.name = body.name.strip()
    row.category = (body.category.strip() if body.category else "General")[:128]
    row.image_url = body.image_url or ""
    row.updated_at = datetime.now(timezone.utc)
    row.elements_json = serialize_elements_json(body.elements)
    row.tasks_json = tasks_model_to_json(body.tasks)
    layers = body.layers if body.layers else default_blueprint_layers()
    row.layers_json = layers_model_to_json(layers)
    await db.commit()
    await db.refresh(row)
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)
    return _row_to_detail(row)


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_map(
    map_id: str,
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1),
) -> None:
    cid = str(user.company_id)
    row = await _get_map(db, cid, map_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    if project_id:
        await _require_project(db, cid, project_id)
        if getattr(row, "project_id", None) != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    await db.execute(delete(FacilityMap).where(FacilityMap.id == map_id, FacilityMap.company_id == cid))
    await db.commit()
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)
