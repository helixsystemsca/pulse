"""Monitoring: batch ingest, sensor detail, readings range."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_tenant_user
from app.core.tenant_feature_access import load_merged_workers_settings, user_has_workers_roster_page_access
from app.core.user_roles import user_has_any_role, user_participates_in_workforce_operations
from app.core.database import get_db
from app.models.domain import User, UserRole
from app.models.gamification_models import Task, UserStats
from app.models.monitoring_models import (
    AlertStatus,
    MonitoredSystem,
    MonitoringAlert,
    MonitoringFacility,
    Sensor,
    SensorReading,
)
from app.modules.monitoring.freshness import sensor_freshness
from app.modules.monitoring.thresholds import evaluate_thresholds_for_reading
from app.schemas.monitoring import (
    MonitoringAlertOut,
    PeopleMonitorRowOut,
    PeopleTaskMiniOut,
    PeopleXpMiniOut,
    ReadingBatchIn,
    ReadingBatchOut,
    SensorDetailOut,
    SensorOut,
    SensorReadingOut,
)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


async def require_people_monitoring_access(
    user: Annotated[User, Depends(require_tenant_user)],
    db: Db,
    cid: CompanyId,
) -> User:
    # Company admins always allowed; otherwise follow Workers delegation rules (manager/supervisor/lead).
    if user_has_any_role(user, UserRole.company_admin):
        return user
    merged = await load_merged_workers_settings(db, cid)
    if not user_has_workers_roster_page_access(user, merged):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="People monitoring is limited to delegated staff.",
        )
    return user


@router.get("/alerts", response_model=list[MonitoringAlertOut])
async def list_monitoring_alerts(
    db: Db,
    company_id: CompanyId,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
) -> list[MonitoringAlertOut]:
    """Tenant-scoped monitoring alerts (threshold violations)."""
    stmt = (
        select(MonitoringAlert)
        .join(Sensor, MonitoringAlert.sensor_id == Sensor.id)
        .join(MonitoredSystem, Sensor.monitored_system_id == MonitoredSystem.id)
        .join(MonitoringFacility, MonitoredSystem.facility_id == MonitoringFacility.id)
        .where(MonitoringFacility.company_id == company_id)
    )
    if status_filter is not None and status_filter != "":
        try:
            st = AlertStatus(status_filter)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status") from e
        stmt = stmt.where(MonitoringAlert.status == st)
    stmt = stmt.order_by(MonitoringAlert.updated_at.desc()).limit(limit)
    rq = await db.execute(stmt)
    rows = list(rq.scalars().all())
    return [MonitoringAlertOut.model_validate(r) for r in rows]


@router.get("/people", response_model=list[PeopleMonitorRowOut])
async def list_people_monitoring(
    db: Db,
    company_id: CompanyId,
    _: Annotated[User, Depends(require_people_monitoring_access)],
    limit: int = Query(200, ge=1, le=500),
) -> list[PeopleMonitorRowOut]:
    """Workforce roster + XP summary + recent assigned tasks."""
    uq = await db.execute(
        select(User)
        .where(User.company_id == company_id, User.is_active.is_(True))
        .order_by(User.full_name.asc().nulls_last(), User.email.asc())
        .limit(limit)
    )
    users = [u for u in uq.scalars().all() if user_participates_in_workforce_operations(u)]
    if not users:
        return []

    ids = [str(u.id) for u in users]
    sq = await db.execute(select(UserStats).where(UserStats.company_id == company_id, UserStats.user_id.in_(ids)))
    stats_by_uid = {str(s.user_id): s for s in sq.scalars().all()}

    tq = await db.execute(
        select(Task)
        .where(
            Task.company_id == company_id,
            Task.assigned_to.in_(ids),
            Task.status.in_(("todo", "in_progress")),
        )
        .order_by(Task.priority.desc(), Task.due_date.asc().nulls_last(), Task.created_at.desc())
        .limit(3000)
    )
    tasks = tq.scalars().all()
    tasks_by_uid: dict[str, list[Task]] = {}
    for t in tasks:
        uid = str(t.assigned_to or "")
        if not uid:
            continue
        bucket = tasks_by_uid.setdefault(uid, [])
        if len(bucket) < 5:
            bucket.append(t)

    out: list[PeopleMonitorRowOut] = []
    for u in users:
        st = stats_by_uid.get(str(u.id))
        total = int(st.total_xp) if st else 0
        lvl = int(st.level) if st else 1
        into = max(0, total % 100)
        pct = float(into) / 100.0 if into > 0 else 0.0
        rt = tasks_by_uid.get(str(u.id), [])[:3]
        out.append(
            PeopleMonitorRowOut(
                user_id=str(u.id),
                full_name=str(u.full_name or "").strip() or str(u.email),
                email=str(u.email),
                role=str(u.roles[0] if u.roles else "worker"),
                roles=list(u.roles or []),
                xp=PeopleXpMiniOut(level=lvl, total_xp=total, into_level=into, pct=pct),
                recent_tasks=[
                    PeopleTaskMiniOut(
                        id=str(t.id),
                        title=str(t.title),
                        status=str(t.status),
                        due_date=t.due_date,
                        priority=int(t.priority or 1),
                    )
                    for t in rt
                ],
            )
        )
    return out


async def _sensor_for_company(db: AsyncSession, sensor_id: str, company_id: str) -> Sensor:
    q = await db.execute(
        select(Sensor)
        .join(Sensor.monitored_system)
        .join(MonitoredSystem.facility)
        .where(Sensor.id == sensor_id)
        .options(
            selectinload(Sensor.monitored_system).selectinload(MonitoredSystem.facility),
        )
    )
    sensor = q.scalar_one_or_none()
    if sensor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    if str(sensor.monitored_system.facility.company_id) != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    return sensor


@router.post("/readings/batch", response_model=ReadingBatchOut)
async def post_readings_batch(
    body: ReadingBatchIn,
    db: Db,
    company_id: CompanyId,
) -> ReadingBatchOut:
    inserted = 0
    skipped_invalid_sensor = 0
    now = datetime.now(timezone.utc)

    for item in body.readings:
        if (
            item.value_num is None
            and item.value_bool is None
            and item.value_text is None
        ):
            skipped_invalid_sensor += 1
            continue

        sq = await db.execute(
            select(Sensor)
            .where(Sensor.id == item.sensor_id)
            .options(
                selectinload(Sensor.monitored_system).selectinload(MonitoredSystem.facility),
                selectinload(Sensor.thresholds),
            ),
        )
        sensor = sq.scalar_one_or_none()
        if sensor is None or str(sensor.monitored_system.facility.company_id) != company_id:
            skipped_invalid_sensor += 1
            continue

        rid = str(uuid4())
        insert_stmt = pg_insert(SensorReading).values(
            id=rid,
            sensor_id=item.sensor_id,
            observed_at=item.observed_at,
            value_num=item.value_num,
            value_bool=item.value_bool,
            value_text=item.value_text,
            received_at=now,
        )
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=["sensor_id", "observed_at"],
            set_={
                "value_num": insert_stmt.excluded.value_num,
                "value_bool": insert_stmt.excluded.value_bool,
                "value_text": insert_stmt.excluded.value_text,
                "received_at": insert_stmt.excluded.received_at,
            },
        ).returning(SensorReading.id)
        res = await db.execute(stmt)
        reading_id = str(res.scalar_one())

        rq = await db.execute(select(SensorReading).where(SensorReading.id == reading_id))
        reading = rq.scalar_one()

        await evaluate_thresholds_for_reading(
            db,
            sensor=sensor,
            reading=reading,
            company_id=company_id,
            facility_id=sensor.monitored_system.facility_id,
        )
        inserted += 1

    await db.commit()
    return ReadingBatchOut(inserted=inserted, skipped_invalid_sensor=skipped_invalid_sensor)


@router.get("/sensors/{sensor_id}", response_model=SensorDetailOut)
async def get_sensor_detail(
    sensor_id: str,
    db: Db,
    company_id: CompanyId,
) -> SensorDetailOut:
    sensor = await _sensor_for_company(db, sensor_id, company_id)
    lq = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_id == sensor_id)
        .order_by(SensorReading.observed_at.desc())
        .limit(1),
    )
    latest = lq.scalar_one_or_none()
    fresh = sensor_freshness(
        latest.observed_at if latest else None,
        expected_interval_seconds=sensor.expected_interval_seconds,
    )
    return SensorDetailOut(
        sensor=SensorOut.model_validate(sensor),
        latest_reading=SensorReadingOut.model_validate(latest) if latest else None,
        freshness=fresh,
    )


@router.get("/sensors/{sensor_id}/readings", response_model=list[SensorReadingOut])
async def get_sensor_readings(
    sensor_id: str,
    db: Db,
    company_id: CompanyId,
    from_time: datetime = Query(..., alias="from"),
    to_time: datetime = Query(..., alias="to"),
    limit: int = Query(1000, ge=1, le=5000),
) -> list[SensorReadingOut]:
    await _sensor_for_company(db, sensor_id, company_id)
    rq = await db.execute(
        select(SensorReading)
        .where(
            SensorReading.sensor_id == sensor_id,
            SensorReading.observed_at >= from_time,
            SensorReading.observed_at <= to_time,
        )
        .order_by(SensorReading.observed_at.asc())
        .limit(limit),
    )
    rows = list(rq.scalars().all())
    return [SensorReadingOut.model_validate(r) for r in rows]
