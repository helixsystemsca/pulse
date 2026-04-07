"""Load tenant + optional user facts used to auto-complete onboarding steps."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import array as pg_array

from app.models.device_hub import AutomationBleDevice, AutomationGateway
from app.models.domain import Company, FacilityEquipment, User, UserRole, Zone
from app.models.monitoring_models import MonitoringFacility, MonitoredSystem, Sensor, SensorReading
from app.models.pulse_models import (
    PulseProjectTask,
    PulseScheduleShift,
    PulseWorkRequest,
    PulseWorkRequestStatus,
)


@dataclass(frozen=True, slots=True)
class OnboardingReality:
    zone_count: int
    equipment_count: int
    gateway_count: int
    ble_device_count: int
    worker_user_count: int
    procedure_task_count: int
    work_request_count: int
    has_recent_sensor_readings: bool
    onboarding_demo_sensors: bool
    user_completed_wr_count: int
    user_created_wr_count: int
    user_shift_count: int


async def load_onboarding_reality(
    db: AsyncSession,
    company_id: str,
    *,
    for_user_id: str | None = None,
) -> OnboardingReality:
    cid = company_id
    since = datetime.now(timezone.utc) - timedelta(days=30)

    cq = await db.execute(select(Company).where(Company.id == cid))
    company = cq.scalar_one_or_none()
    demo = bool(company.onboarding_demo_sensors) if company else False

    zone_count = int(
        await db.scalar(select(func.count()).select_from(Zone).where(Zone.company_id == cid)) or 0
    )
    equipment_count = int(
        await db.scalar(
            select(func.count()).select_from(FacilityEquipment).where(FacilityEquipment.company_id == cid)
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
    work_request_count = int(
        await db.scalar(
            select(func.count()).select_from(PulseWorkRequest).where(PulseWorkRequest.company_id == cid)
        )
        or 0
    )

    reading_row = await db.execute(
        select(SensorReading.id)
        .join(Sensor, Sensor.id == SensorReading.sensor_id)
        .join(MonitoredSystem, MonitoredSystem.id == Sensor.monitored_system_id)
        .join(MonitoringFacility, MonitoringFacility.id == MonitoredSystem.facility_id)
        .where(
            MonitoringFacility.company_id == cid,
            SensorReading.observed_at >= since,
        )
        .limit(1)
    )
    has_recent_sensor_readings = reading_row.scalar_one_or_none() is not None

    uid = for_user_id
    user_completed_wr_count = 0
    user_created_wr_count = 0
    user_shift_count = 0
    if uid:
        user_completed_wr_count = int(
            await db.scalar(
                select(func.count())
                .select_from(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == cid,
                    PulseWorkRequest.assigned_user_id == uid,
                    PulseWorkRequest.status == PulseWorkRequestStatus.completed,
                )
            )
            or 0
        )
        user_created_wr_count = int(
            await db.scalar(
                select(func.count())
                .select_from(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == cid,
                    PulseWorkRequest.created_by_user_id == uid,
                )
            )
            or 0
        )
        user_shift_count = int(
            await db.scalar(
                select(func.count())
                .select_from(PulseScheduleShift)
                .where(
                    PulseScheduleShift.company_id == cid,
                    PulseScheduleShift.assigned_user_id == uid,
                )
            )
            or 0
        )

    return OnboardingReality(
        zone_count=zone_count,
        equipment_count=equipment_count,
        gateway_count=gateway_count,
        ble_device_count=ble_device_count,
        worker_user_count=worker_user_count,
        procedure_task_count=procedure_task_count,
        work_request_count=work_request_count,
        has_recent_sensor_readings=has_recent_sensor_readings,
        onboarding_demo_sensors=demo,
        user_completed_wr_count=user_completed_wr_count,
        user_created_wr_count=user_created_wr_count,
        user_shift_count=user_shift_count,
    )
