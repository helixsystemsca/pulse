"""GET `/api/v1/setup-progress` — live counts for the dashboard setup checklist."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.blueprint_models import Blueprint
from app.models.domain import FacilityEquipment, User, UserRole, Zone
from app.models.pulse_models import PulseProjectTask
from app.schemas.setup_progress import SetupProgressOut

router = APIRouter(prefix="/setup-progress", tags=["setup-progress"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=SetupProgressOut)
async def get_setup_progress(db: Db, user: Annotated[User, Depends(get_current_company_user)]) -> SetupProgressOut:
    cid = str(user.company_id)

    blueprint_count = int(
        await db.scalar(select(func.count()).select_from(Blueprint).where(Blueprint.company_id == cid)) or 0
    )
    zone_count = int(
        await db.scalar(select(func.count()).select_from(Zone).where(Zone.company_id == cid)) or 0
    )
    equipment_count = int(
        await db.scalar(select(func.count()).select_from(FacilityEquipment).where(FacilityEquipment.company_id == cid))
        or 0
    )
    worker_user_count = int(
        await db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.company_id == cid,
                User.roles.overlap(pg_array([UserRole.worker.value])),
                User.is_active.is_(True),
            )
        )
        or 0
    )
    procedure_task_count = int(
        await db.scalar(
            select(func.count()).select_from(PulseProjectTask).where(PulseProjectTask.company_id == cid)
        )
        or 0
    )

    return SetupProgressOut(
        blueprint_count=blueprint_count,
        zone_count=zone_count,
        equipment_count=equipment_count,
        worker_user_count=worker_user_count,
        procedure_task_count=procedure_task_count,
        facility_layout_done=blueprint_count > 0,
        zones_done=zone_count > 0,
        equipment_done=equipment_count > 0,
        workers_done=worker_user_count > 0,
        procedures_done=procedure_task_count > 0,
    )
