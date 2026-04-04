"""Floorplan blueprints — `/api/blueprints`. Tenant-scoped."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.blueprint_models import Blueprint, BlueprintElement
from app.models.domain import User
from app.schemas.blueprint import (
    BlueprintCreateIn,
    BlueprintDetailOut,
    BlueprintElementOut,
    BlueprintSummaryOut,
    BlueprintUpdateIn,
    element_in_to_orm_kwargs,
    row_to_element_out,
)

router = APIRouter(prefix="/blueprints", tags=["blueprints"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]


async def _get_blueprint(db: AsyncSession, company_id: str, blueprint_id: str) -> Blueprint | None:
    q = await db.execute(
        select(Blueprint).where(Blueprint.id == blueprint_id, Blueprint.company_id == company_id)
    )
    return q.scalar_one_or_none()


@router.get("", response_model=list[BlueprintSummaryOut])
async def list_blueprints(db: Db, user: TenantUser) -> list[BlueprintSummaryOut]:
    cid = str(user.company_id)
    q = await db.execute(
        select(Blueprint).where(Blueprint.company_id == cid).order_by(Blueprint.created_at.desc())
    )
    rows = q.scalars().all()
    return [BlueprintSummaryOut(id=r.id, name=r.name, created_at=r.created_at) for r in rows]


@router.post("", response_model=BlueprintDetailOut, status_code=status.HTTP_201_CREATED)
async def create_blueprint(body: BlueprintCreateIn, db: Db, user: TenantUser) -> BlueprintDetailOut:
    cid = str(user.company_id)
    bp = Blueprint(company_id=cid, name=body.name.strip())
    db.add(bp)
    await db.flush()
    for el in body.elements:
        try:
            kwargs = element_in_to_orm_kwargs(el, blueprint_id=bp.id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        db.add(BlueprintElement(**kwargs))
    await db.commit()
    await db.refresh(bp)
    return await _detail_out(db, bp)


@router.get("/{blueprint_id}", response_model=BlueprintDetailOut)
async def get_blueprint(blueprint_id: str, db: Db, user: TenantUser) -> BlueprintDetailOut:
    cid = str(user.company_id)
    bp = await _get_blueprint(db, cid, blueprint_id)
    if not bp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return await _detail_out(db, bp)


@router.put("/{blueprint_id}", response_model=BlueprintDetailOut)
async def update_blueprint(
    blueprint_id: str, body: BlueprintUpdateIn, db: Db, user: TenantUser
) -> BlueprintDetailOut:
    cid = str(user.company_id)
    bp = await _get_blueprint(db, cid, blueprint_id)
    if not bp:
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
    await db.commit()
    await db.refresh(bp)
    return await _detail_out(db, bp)


async def _detail_out(db: AsyncSession, bp: Blueprint) -> BlueprintDetailOut:
    q = await db.execute(
        select(BlueprintElement).where(BlueprintElement.blueprint_id == bp.id).order_by(BlueprintElement.id)
    )
    elems = q.scalars().all()
    elements: list[BlueprintElementOut] = [row_to_element_out(e) for e in elems]
    return BlueprintDetailOut(
        id=bp.id,
        name=bp.name,
        created_at=bp.created_at,
        updated_at=bp.updated_at,
        elements=elements,
    )
