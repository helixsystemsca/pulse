"""GET `/api/v1/setup-progress` — live counts for the dashboard setup checklist."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.blueprint_models import Blueprint
from app.services.onboarding_reality import blueprint_zone_shape_count
from app.models.device_hub import AutomationBleDevice, AutomationGateway
from app.models.domain import Company, FacilityEquipment, User, UserRole, Zone
from app.models.pulse_models import PulseProjectTask, PulseWorkRequest
from app.schemas.setup_progress import SetupProgressOut

router = APIRouter(prefix="/setup-progress", tags=["setup-progress"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=SetupProgressOut)
async def get_setup_progress(db: Db, user: Annotated[User, Depends(get_current_company_user)]) -> SetupProgressOut:
    cid = str(user.company_id)

    co = await db.get(Company, cid)
    onboarding_demo_sensors = bool(co.onboarding_demo_sensors) if co else False

    blueprint_count = int(
        await db.scalar(select(func.count()).select_from(Blueprint).where(Blueprint.company_id == cid)) or 0
    )
    zone_count = int(
        await db.scalar(select(func.count()).select_from(Zone).where(Zone.company_id == cid)) or 0
    )
    blueprint_zone_shapes = await blueprint_zone_shape_count(db, cid)
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
    gateway_count = int(
        await db.scalar(
            select(func.count()).select_from(AutomationGateway).where(AutomationGateway.company_id == cid)
        )
        or 0
    )
    ble_device_count = int(
        await db.scalar(
            select(func.count()).select_from(AutomationBleDevice).where(AutomationBleDevice.company_id == cid)
        )
        or 0
    )
    work_request_count = int(
        await db.scalar(
            select(func.count()).select_from(PulseWorkRequest).where(PulseWorkRequest.company_id == cid)
        )
        or 0
    )

    devices_done = gateway_count + ble_device_count > 0 or onboarding_demo_sensors
    maintenance_started_done = work_request_count > 0 or procedure_task_count > 0

    return SetupProgressOut(
        blueprint_count=blueprint_count,
        zone_count=zone_count,
        equipment_count=equipment_count,
        worker_user_count=worker_user_count,
        procedure_task_count=procedure_task_count,
        gateway_count=gateway_count,
        ble_device_count=ble_device_count,
        work_request_count=work_request_count,
        onboarding_demo_sensors=onboarding_demo_sensors,
        facility_layout_done=blueprint_count > 0,
        zones_done=zone_count > 0 or blueprint_zone_shapes > 0,
        equipment_done=equipment_count > 0,
        workers_done=worker_user_count > 0,
        procedures_done=procedure_task_count > 0,
        devices_done=devices_done,
        maintenance_started_done=maintenance_started_done,
    )
