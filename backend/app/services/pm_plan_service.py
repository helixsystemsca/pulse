"""Soft-start PM plan logic: compute due dates and generate Work Requests."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulsePmPlan,
    PulseWorkOrderSource,
    PulseWorkOrderType,
    PulseWorkRequest,
    PulseWorkRequestPriority,
    PulseWorkRequestStatus,
)


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def compute_next_due_at(*, start_date: date, frequency: str, custom_interval_days: Optional[int]) -> datetime:
    """
    Soft-start scheduling:
    - The first generated instance is due on `start_date` (not after the interval).
    - Subsequent due dates advance by the frequency.
    """
    base = datetime.combine(start_date, time(hour=9, minute=0), tzinfo=timezone.utc)
    return base


def advance_due_at(*, current_due_at: datetime, frequency: str, custom_interval_days: Optional[int]) -> datetime:
    if current_due_at.tzinfo is None:
        current_due_at = current_due_at.replace(tzinfo=timezone.utc)
    f = (frequency or "").strip().lower()
    if f == "daily":
        return current_due_at + timedelta(days=1)
    if f == "weekly":
        return current_due_at + timedelta(days=7)
    if f == "monthly":
        # simple calendar month advance: keep day number when possible
        y, m = current_due_at.year, current_due_at.month
        nm = m + 1
        ny = y + (nm - 1) // 12
        nm = (nm - 1) % 12 + 1
        # clamp day
        last = monthrange(ny, nm)[1]
        d = min(current_due_at.day, last)
        return current_due_at.replace(year=ny, month=nm, day=d)
    if f == "custom":
        days = int(custom_interval_days or 1)
        return current_due_at + timedelta(days=max(1, days))
    if f == "annual":
        y = current_due_at.year + 1
        m, d = current_due_at.month, current_due_at.day
        last = monthrange(y, m)[1]
        d = min(d, last)
        return current_due_at.replace(year=y, month=m, day=d)
    raise ValueError("frequency must be daily, weekly, monthly, annual, or custom")


def _apply_due_offset(due_at: datetime, offset_days: Optional[int]) -> datetime:
    off = int(offset_days or 0)
    if off <= 0:
        return due_at
    return due_at + timedelta(days=off)


async def has_open_work_request_for_plan(db: AsyncSession, *, pm_plan_id: str) -> bool:
    q = await db.execute(
        select(PulseWorkRequest.id).where(
            PulseWorkRequest.pm_plan_id == pm_plan_id,
            PulseWorkRequest.status.in_(
                (
                    PulseWorkRequestStatus.open,
                    PulseWorkRequestStatus.in_progress,
                    PulseWorkRequestStatus.hold,
                )
            ),
        )
    )
    return q.scalar_one_or_none() is not None


async def create_pm_plan_and_first_work_request(
    db: AsyncSession,
    *,
    company_id: str,
    title: str,
    description: Optional[str],
    frequency: str,
    start_date: date,
    due_time_offset_days: Optional[int],
    assigned_user_id: Optional[str],
    custom_interval_days: Optional[int],
) -> tuple[PulsePmPlan, PulseWorkRequest]:
    due_at = compute_next_due_at(start_date=start_date, frequency=frequency, custom_interval_days=custom_interval_days)
    due_at = _apply_due_offset(due_at, due_time_offset_days)

    plan = PulsePmPlan(
        company_id=str(company_id),
        title=title.strip()[:255],
        description=(description or "").strip() or None,
        frequency=str(frequency).strip().lower(),
        custom_interval_days=int(custom_interval_days) if custom_interval_days is not None else None,
        start_date=start_date,
        due_time_offset_days=int(due_time_offset_days) if due_time_offset_days is not None else None,
        assigned_user_id=str(assigned_user_id) if assigned_user_id else None,
        equipment_id=None,
        template_id=None,
        plan_metadata={},
        last_generated_at=None,
        next_due_at=due_at,
    )
    db.add(plan)
    await db.flush()

    wr = PulseWorkRequest(
        company_id=str(company_id),
        title=plan.title,
        description=plan.description,
        status=PulseWorkRequestStatus.open,
        due_date=plan.next_due_at,
        priority=PulseWorkRequestPriority.medium,
        work_order_type=PulseWorkOrderType.preventative,
        work_order_source=PulseWorkOrderSource.auto_pm,
        pm_plan_id=str(plan.id),
        work_request_kind="preventative_maintenance",
        assigned_user_id=str(assigned_user_id) if assigned_user_id else None,
        attachments=[],
    )
    db.add(wr)
    await db.flush()

    plan.last_generated_at = datetime.now(timezone.utc)
    await db.flush()

    return plan, wr


async def sync_pm_plan_after_work_request_completed(db: AsyncSession, wr: PulseWorkRequest) -> None:
    if not wr.pm_plan_id:
        return
    if wr.status != PulseWorkRequestStatus.completed:
        return
    plan = await db.get(PulsePmPlan, str(wr.pm_plan_id))
    if not plan or str(plan.company_id) != str(wr.company_id):
        return
    plan.next_due_at = advance_due_at(
        current_due_at=plan.next_due_at,
        frequency=plan.frequency,
        custom_interval_days=plan.custom_interval_days,
    )
    plan.updated_at = datetime.now(timezone.utc)


async def create_due_work_request_for_plan(db: AsyncSession, plan: PulsePmPlan) -> PulseWorkRequest | None:
    if await has_open_work_request_for_plan(db, pm_plan_id=str(plan.id)):
        return None
    wr = PulseWorkRequest(
        company_id=str(plan.company_id),
        title=plan.title,
        description=plan.description,
        status=PulseWorkRequestStatus.open,
        due_date=plan.next_due_at,
        priority=PulseWorkRequestPriority.medium,
        work_order_type=PulseWorkOrderType.preventative,
        work_order_source=PulseWorkOrderSource.auto_pm,
        pm_plan_id=str(plan.id),
        work_request_kind="preventative_maintenance",
        assigned_user_id=str(plan.assigned_user_id) if plan.assigned_user_id else None,
        attachments=[],
    )
    db.add(wr)
    plan.last_generated_at = datetime.now(timezone.utc)
    await db.flush()
    return wr

