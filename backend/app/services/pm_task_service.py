"""Preventive maintenance: next due dates, auto work orders, completion sync."""

from __future__ import annotations

import calendar
import logging
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import EquipmentPart, FacilityEquipment
from app.models.pm_models import (
    PmFrequencyType,
    PmTask,
    PmTaskChecklistItem,
    PmTaskPart,
    PulseWorkRequestChecklistItem,
    PulseWorkRequestPartLine,
)
from app.models.pulse_models import (
    PulseWorkOrderSource,
    PulseWorkOrderType,
    PulseWorkRequest,
    PulseWorkRequestPriority,
    PulseWorkRequestStatus,
)
from app.services.gamification_service import ensure_task_for_pm_due

_log = logging.getLogger(__name__)

_OPEN_STATUSES = (
    PulseWorkRequestStatus.open,
    PulseWorkRequestStatus.in_progress,
    PulseWorkRequestStatus.hold,
)


def add_calendar_months(dt: datetime, months: int) -> datetime:
    if months == 0:
        return dt
    y, m = dt.year, dt.month
    total_m = m - 1 + months
    ny = y + total_m // 12
    nm = total_m % 12 + 1
    last_day = calendar.monthrange(ny, nm)[1]
    d = min(dt.day, last_day)
    return dt.replace(year=ny, month=nm, day=d, hour=dt.hour, minute=dt.minute, second=dt.second, microsecond=dt.microsecond)


def compute_next_due_at(
    *,
    baseline: datetime,
    frequency_type: str,
    frequency_value: int,
) -> datetime:
    if baseline.tzinfo is None:
        baseline = baseline.replace(tzinfo=timezone.utc)
    fv = max(1, int(frequency_value))
    ft = frequency_type if isinstance(frequency_type, str) else str(frequency_type)
    if ft == PmFrequencyType.days.value:
        return baseline + timedelta(days=fv)
    if ft == PmFrequencyType.weeks.value:
        return baseline + timedelta(days=7 * fv)
    if ft == PmFrequencyType.months.value:
        return add_calendar_months(baseline, fv)
    raise ValueError(f"Invalid frequency_type: {frequency_type!r}")


def _parse_frequency_type(raw: str) -> str:
    v = (raw or "").strip().lower()
    if v in ("days", "weeks", "months"):
        return v
    raise ValueError("frequency_type must be days, weeks, or months")


async def sync_pm_task_after_work_order_completed(db: AsyncSession, wr: PulseWorkRequest) -> None:
    """When a PM-linked work order is completed, advance the task schedule."""
    if not wr.pm_task_id:
        return
    if wr.status != PulseWorkRequestStatus.completed:
        return
    task = (
        (await db.execute(select(PmTask).where(PmTask.id == wr.pm_task_id, PmTask.company_id == str(wr.company_id))))
        .scalars()
        .one_or_none()
    )
    if not task:
        return
    now = datetime.now(timezone.utc)
    task.last_completed_at = now
    task.next_due_at = compute_next_due_at(
        baseline=now,
        frequency_type=task.frequency_type,
        frequency_value=task.frequency_value,
    )
    task.updated_at = now


async def _has_open_work_order_for_pm_task(db: AsyncSession, pm_task_id: str) -> bool:
    q = await db.execute(
        select(PulseWorkRequest.id).where(
            PulseWorkRequest.pm_task_id == pm_task_id,
            PulseWorkRequest.status.in_(_OPEN_STATUSES),
        )
    )
    return q.scalar_one_or_none() is not None


async def _copy_pm_template_to_work_order(
    db: AsyncSession,
    *,
    work_request_id: str,
    pm_task_id: str,
) -> None:
    parts = (
        (
            await db.execute(select(PmTaskPart).where(PmTaskPart.pm_task_id == pm_task_id).order_by(PmTaskPart.id))
        )
        .scalars()
        .all()
    )
    for row in parts:
        db.add(
            PulseWorkRequestPartLine(
                work_request_id=work_request_id,
                part_id=row.part_id,
                quantity=row.quantity,
            )
        )
    items = (
        (
            await db.execute(
                select(PmTaskChecklistItem)
                .where(PmTaskChecklistItem.pm_task_id == pm_task_id)
                .order_by(PmTaskChecklistItem.sort_order, PmTaskChecklistItem.id)
            )
        )
        .scalars()
        .all()
    )
    for row in items:
        db.add(
            PulseWorkRequestChecklistItem(
                work_request_id=work_request_id,
                label=row.label,
                sort_order=row.sort_order,
            )
        )


async def create_auto_pm_work_order(db: AsyncSession, task: PmTask, *, company_id: str) -> PulseWorkRequest | None:
    """Create a preventative work order for this PM task, or return None if a guard prevents it."""
    if not task.auto_create_work_order:
        return None
    if await _has_open_work_order_for_pm_task(db, task.id):
        return None

    eq = await db.get(FacilityEquipment, task.equipment_id)
    if not eq or str(eq.company_id) != str(company_id):
        _log.warning("Skipping PM WO — equipment %s missing or wrong company", task.equipment_id)
        return None

    wr = PulseWorkRequest(
        company_id=str(company_id),
        title=task.name,
        description=task.description,
        equipment_id=task.equipment_id,
        zone_id=eq.zone_id,
        work_order_type=PulseWorkOrderType.preventative,
        work_order_source=PulseWorkOrderSource.auto_pm,
        status=PulseWorkRequestStatus.open,
        due_date=task.next_due_at,
        priority=PulseWorkRequestPriority.medium,
        pm_task_id=task.id,
        attachments=[],
    )
    db.add(wr)
    await db.flush()
    # Auto task generation: PM due -> gamified task.
    # We link the task to the PM template id (source_id), not the work order, so repeated scans don't spam.
    await ensure_task_for_pm_due(
        db,
        company_id=str(company_id),
        pm_task_id=str(task.id),
        title=task.name,
        description=task.description,
        equipment_id=task.equipment_id,
        due_at=task.next_due_at,
    )
    await _copy_pm_template_to_work_order(db, work_request_id=wr.id, pm_task_id=task.id)
    return wr


async def run_pm_due_scan(db: AsyncSession) -> dict[str, int]:
    """
    For each PM task due within 7 days (or overdue), create an open preventative work order when none exists.
    """
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=7)
    rows = (
        (
            await db.execute(
                select(PmTask).where(
                    PmTask.auto_create_work_order.is_(True),
                    PmTask.tool_id.is_(None),
                    PmTask.next_due_at <= horizon,
                )
            )
        )
        .scalars()
        .all()
    )
    created = 0
    for task in rows:
        try:
            async with db.begin_nested():
                wr = await create_auto_pm_work_order(db, task, company_id=str(task.company_id))
                if wr:
                    created += 1
        except IntegrityError:
            _log.info("PM task %s: skipped creating WO (concurrent or duplicate open row)", task.id)
    await db.commit()
    return {"work_orders_created": created}


def validate_pm_frequency(frequency_type: str, frequency_value: int) -> tuple[str, int]:
    ft = _parse_frequency_type(frequency_type)
    fv = int(frequency_value)
    if fv < 1:
        raise ValueError("frequency_value must be at least 1")
    return ft, fv


async def assert_parts_belong_to_equipment(
    db: AsyncSession, *, equipment_id: str, part_ids: Iterable[str]
) -> None:
    ids = list(part_ids)
    if not ids:
        return
    q = await db.execute(
        select(EquipmentPart.id).where(
            EquipmentPart.equipment_id == equipment_id,
            EquipmentPart.id.in_(ids),
        )
    )
    found = {str(x) for x in q.scalars().all()}
    missing = [pid for pid in ids if pid not in found]
    if missing:
        raise ValueError("One or more parts are not on this equipment")
