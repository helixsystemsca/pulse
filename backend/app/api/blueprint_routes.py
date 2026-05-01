"""Floorplan blueprints — `/api/blueprints`. Tenant-scoped."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_admin_user, get_current_company_user, get_db
from app.models.blueprint_models import Blueprint, BlueprintElement
from app.models.domain import User
from app.models.pulse_models import PulseProject
from app.schemas.blueprint import (
    BlueprintCreateIn,
    BlueprintDetailOut,
    BlueprintElementOut,
    BlueprintSummaryOut,
    BlueprintUpdateIn,
    default_blueprint_layers,
    element_in_to_orm_kwargs,
    layers_model_to_json,
    parse_layers_json,
    parse_tasks_json,
    row_to_element_out,
    tasks_model_to_json,
)
from app.services.onboarding_service import sync_user_onboarding_from_reality

router = APIRouter(prefix="/blueprints", tags=["blueprints"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]
CompanyAdminUser = Annotated[User, Depends(get_current_company_admin_user)]


async def _get_blueprint(db: AsyncSession, company_id: str, blueprint_id: str) -> Blueprint | None:
    q = await db.execute(
        select(Blueprint).where(Blueprint.id == blueprint_id, Blueprint.company_id == company_id)
    )
    return q.scalar_one_or_none()


async def _require_project(db: AsyncSession, company_id: str, project_id: str) -> None:
    ok = (
        await db.execute(select(PulseProject.id).where(PulseProject.company_id == company_id, PulseProject.id == project_id))
    ).scalar_one_or_none()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.get("", response_model=list[BlueprintSummaryOut])
async def list_blueprints(
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, only blueprints for this pulse project"),
) -> list[BlueprintSummaryOut]:
    cid = str(user.company_id)
    filt = [Blueprint.company_id == cid]
    if project_id:
        await _require_project(db, cid, project_id)
        filt.append(Blueprint.project_id == project_id)
    q = await db.execute(select(Blueprint).where(*filt).order_by(Blueprint.created_at.desc()))
    rows = q.scalars().all()
    return [
        BlueprintSummaryOut(id=r.id, name=r.name, created_at=r.created_at, project_id=getattr(r, "project_id", None))
        for r in rows
    ]


@router.post("", response_model=BlueprintDetailOut, status_code=status.HTTP_201_CREATED)
async def create_blueprint(body: BlueprintCreateIn, db: Db, user: TenantUser) -> BlueprintDetailOut:
    cid = str(user.company_id)
    raw_pid = body.project_id.strip() if body.project_id and str(body.project_id).strip() else None
    if raw_pid:
        await _require_project(db, cid, raw_pid)
    bp = Blueprint(company_id=cid, name=body.name.strip(), project_id=raw_pid)
    db.add(bp)
    await db.flush()
    for el in body.elements:
        try:
            kwargs = element_in_to_orm_kwargs(el, blueprint_id=bp.id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        db.add(BlueprintElement(**kwargs))
    bp.tasks_json = tasks_model_to_json(body.tasks)
    layers = body.layers if body.layers else default_blueprint_layers()
    bp.layers_json = layers_model_to_json(layers)
    await db.commit()
    await db.refresh(bp)
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)
    return await _detail_out(db, bp)


@router.get("/{blueprint_id}", response_model=BlueprintDetailOut)
async def get_blueprint(
    blueprint_id: str,
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, blueprint must belong to this project"),
) -> BlueprintDetailOut:
    cid = str(user.company_id)
    bp = await _get_blueprint(db, cid, blueprint_id)
    if not bp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    if project_id:
        await _require_project(db, cid, project_id)
        if getattr(bp, "project_id", None) != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return await _detail_out(db, bp)


@router.put("/{blueprint_id}", response_model=BlueprintDetailOut)
async def update_blueprint(
    blueprint_id: str,
    body: BlueprintUpdateIn,
    db: Db,
    user: TenantUser,
    project_id: Optional[str] = Query(None, min_length=1, description="When set, blueprint must belong to this project"),
) -> BlueprintDetailOut:
    cid = str(user.company_id)
    bp = await _get_blueprint(db, cid, blueprint_id)
    if not bp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    if project_id:
        await _require_project(db, cid, project_id)
        if getattr(bp, "project_id", None) != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    bp.name = body.name.strip()
    bp.updated_at = datetime.now(timezone.utc)
    await db.execute(delete(BlueprintElement).where(BlueprintElement.blueprint_id == blueprint_id))
    for el in body.elements:
        try:
            kwargs = element_in_to_orm_kwargs(el, blueprint_id=bp.id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        db.add(BlueprintElement(**kwargs))
    bp.tasks_json = tasks_model_to_json(body.tasks)
    layers = body.layers if body.layers else default_blueprint_layers()
    bp.layers_json = layers_model_to_json(layers)
    await db.commit()
    await db.refresh(bp)
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)
    return await _detail_out(db, bp)


@router.delete("/{blueprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blueprint(blueprint_id: str, db: Db, user: CompanyAdminUser) -> None:
    cid = str(user.company_id)
    bp = await _get_blueprint(db, cid, blueprint_id)
    if not bp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    await db.execute(delete(Blueprint).where(Blueprint.id == blueprint_id, Blueprint.company_id == cid))
    await db.commit()
    await db.refresh(user)
    if await sync_user_onboarding_from_reality(db, user):
        await db.commit()
        await db.refresh(user)


async def _detail_out(db: AsyncSession, bp: Blueprint) -> BlueprintDetailOut:
    q = await db.execute(
        select(BlueprintElement).where(BlueprintElement.blueprint_id == bp.id).order_by(BlueprintElement.id)
    )
    elems = q.scalars().all()
    elements: list[BlueprintElementOut] = [row_to_element_out(e) for e in elems]
    raw_layers = parse_layers_json(getattr(bp, "layers_json", None))
    layers = raw_layers if raw_layers else default_blueprint_layers()
    return BlueprintDetailOut(
        id=bp.id,
        name=bp.name,
        created_at=bp.created_at,
        updated_at=bp.updated_at,
        project_id=getattr(bp, "project_id", None),
        elements=elements,
        tasks=parse_tasks_json(getattr(bp, "tasks_json", None)),
        layers=layers,
    )
