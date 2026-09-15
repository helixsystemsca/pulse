"""Shared validation for linking equipment/inventory onto recreation facilities."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import FacilityEquipment, InventoryItem
from app.models.ops_foundation_models import OpsFacility

_PARENT_WALK_LIMIT = 16


async def require_ops_facility(
    db: AsyncSession, company_id: str, facility_id: Optional[str]
) -> Optional[OpsFacility]:
    if not facility_id:
        return None
    row = await db.get(OpsFacility, facility_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=400, detail="Invalid facility for this company")
    return row


async def require_parent_equipment(
    db: AsyncSession,
    company_id: str,
    parent_id: Optional[str],
    *,
    self_id: Optional[str] = None,
) -> Optional[FacilityEquipment]:
    if not parent_id:
        return None
    if self_id and str(parent_id) == str(self_id):
        raise HTTPException(status_code=400, detail="Equipment cannot be its own parent")
    row = await db.get(FacilityEquipment, parent_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=400, detail="Invalid parent asset for this company")
    current = row.parent_equipment_id
    depth = 0
    while current and depth < _PARENT_WALK_LIMIT:
        if self_id and str(current) == str(self_id):
            raise HTTPException(status_code=400, detail="Parent would create a cycle")
        parent = await db.get(FacilityEquipment, current)
        if not parent or str(parent.company_id) != str(company_id):
            break
        current = parent.parent_equipment_id
        depth += 1
    return row


def inherit_facility_id(
    explicit: Optional[str], parent: Optional[FacilityEquipment]
) -> Optional[str]:
    if explicit:
        return explicit
    if parent is not None and getattr(parent, "ops_facility_id", None):
        return str(parent.ops_facility_id)
    return None


async def facility_titles_by_id(
    db: AsyncSession, company_id: str, ids: set[str]
) -> dict[str, str]:
    clean = {str(i) for i in ids if i}
    if not clean:
        return {}
    rows = (
        await db.execute(
            select(OpsFacility.id, OpsFacility.title).where(
                OpsFacility.company_id == company_id, OpsFacility.id.in_(list(clean))
            )
        )
    ).all()
    return {str(r[0]): r[1] for r in rows}


async def equipment_names_by_id(
    db: AsyncSession, company_id: str, ids: set[str]
) -> dict[str, str]:
    clean = {str(i) for i in ids if i}
    if not clean:
        return {}
    rows = (
        await db.execute(
            select(FacilityEquipment.id, FacilityEquipment.name).where(
                FacilityEquipment.company_id == company_id, FacilityEquipment.id.in_(list(clean))
            )
        )
    ).all()
    return {str(r[0]): r[1] for r in rows}


async def list_facility_equipment(
    db: AsyncSession, company_id: str, facility_id: str
) -> list[FacilityEquipment]:
    q = await db.execute(
        select(FacilityEquipment)
        .where(
            FacilityEquipment.company_id == company_id,
            FacilityEquipment.ops_facility_id == facility_id,
        )
        .order_by(FacilityEquipment.name.asc())
    )
    return list(q.scalars().all())


async def list_facility_inventory(
    db: AsyncSession, company_id: str, facility_id: str
) -> list[InventoryItem]:
    q = await db.execute(
        select(InventoryItem)
        .where(
            InventoryItem.company_id == company_id,
            InventoryItem.ops_facility_id == facility_id,
        )
        .order_by(InventoryItem.name.asc())
    )
    return list(q.scalars().all())
