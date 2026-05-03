"""Blueprint zone shape counts (used by setup progress)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blueprint_models import Blueprint, BlueprintElement


async def blueprint_zone_shape_count(db: AsyncSession, company_id: str) -> int:
    """Room/zone shapes drawn on saved floorplan blueprints (`element_type == zone`)."""
    return int(
        await db.scalar(
            select(func.count())
            .select_from(BlueprintElement)
            .join(Blueprint, Blueprint.id == BlueprintElement.blueprint_id)
            .where(Blueprint.company_id == company_id, BlueprintElement.element_type == "zone")
        )
        or 0
    )
