"""Projects / tasks CRUD and calendar (pulse_schedule_shifts) sync."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User, Zone
from app.models.pulse_models import (
    PulseProject,
    PulseProjectStatus,
    PulseProjectTask,
    PulseScheduleShift,
    PulseTaskPriority,
    PulseTaskStatus,
)
from app.modules.pulse import service as pulse_svc


def _priority_to_shift_type(priority: PulseTaskPriority | str) -> str:
    pv = priority.value if hasattr(priority, "value") else str(priority)
    if pv == "critical":
        return "night"
    if pv == "high":
        return "afternoon"
    return "day"


def _window_for_due_date(d: date, slot_hour: Optional[int] = None) -> tuple[datetime, datetime]:
    """1h UTC block on due date; vary hour by date to reduce overlap validation failures."""
    h = slot_hour if slot_hour is not None else 9 + (d.day + d.month * 3) % 8
    start = datetime(d.year, d.month, d.day, h, 0, tzinfo=timezone.utc)
    return start, start + timedelta(hours=1)


def parse_project_status(v: str) -> PulseProjectStatus:
    try:
        return PulseProjectStatus(v)
    except ValueError:
        return PulseProjectStatus.active


def parse_task_priority(v: str) -> PulseTaskPriority:
    try:
        return PulseTaskPriority(v)
    except ValueError:
        return PulseTaskPriority.medium


def parse_task_status(v: str) -> PulseTaskStatus:
    try:
        return PulseTaskStatus(v)
    except ValueError:
        return PulseTaskStatus.todo


async def user_in_company(db: AsyncSession, company_id: str, user_id: str) -> bool:
    q = await db.execute(
        select(User.id).where(User.id == user_id, User.company_id == company_id, User.is_active.is_(True))
    )
    return q.scalar_one_or_none() is not None


async def _get_any_zone_id(db: AsyncSession, company_id: str) -> Optional[str]:
    z = await db.execute(select(Zone.id).where(Zone.company_id == company_id).limit(1))
    row = z.scalar_one_or_none()
    return str(row) if row else None


async def ensure_calendar_shift_for_task(
    db: AsyncSession,
    company_id: str,
    task: PulseProjectTask,
) -> None:
    """Create or replace linked pulse_schedule_shifts row when task has assignee + due_date."""
    if not task.due_date or not task.assigned_user_id:
        if task.calendar_shift_id:
            sh = await db.get(PulseScheduleShift, task.calendar_shift_id)
            if sh:
                await db.execute(delete(PulseScheduleShift).where(PulseScheduleShift.id == sh.id))
            task.calendar_shift_id = None
        return

    starts_at, ends_at = _window_for_due_date(task.due_date)
    stype = _priority_to_shift_type(task.priority)

    if task.calendar_shift_id:
        sh = await db.get(PulseScheduleShift, task.calendar_shift_id)
        if sh and sh.company_id == company_id:
            errs, _warn = await pulse_svc.validate_shift_assignment(
                db,
                company_id,
                starts_at,
                ends_at,
                str(task.assigned_user_id),
                False,
                False,
                exclude_shift_id=str(sh.id),
            )
            if errs:
                return
            sh.starts_at = starts_at
            sh.ends_at = ends_at
            sh.assigned_user_id = str(task.assigned_user_id)
            sh.shift_type = stype
            sh.display_label = task.title
            sh.shift_kind = "project_task"
            await db.flush()
            return

    zone_id = await _get_any_zone_id(db, company_id)
    errs, _warn = await pulse_svc.validate_shift_assignment(
        db,
        company_id,
        starts_at,
        ends_at,
        str(task.assigned_user_id),
        False,
        False,
        None,
    )
    if errs:
        return

    sh = PulseScheduleShift(
        company_id=company_id,
        assigned_user_id=str(task.assigned_user_id),
        zone_id=zone_id,
        starts_at=starts_at,
        ends_at=ends_at,
        shift_type=stype,
        requires_supervisor=False,
        requires_ticketed=False,
        shift_kind="project_task",
        display_label=task.title,
    )
    db.add(sh)
    await db.flush()
    task.calendar_shift_id = str(sh.id)
    await db.flush()


async def delete_calendar_shift_for_task(db: AsyncSession, task: PulseProjectTask) -> None:
    if not task.calendar_shift_id:
        return
    sid = str(task.calendar_shift_id)
    task.calendar_shift_id = None
    await db.flush()
    await db.execute(delete(PulseScheduleShift).where(PulseScheduleShift.id == sid))
    await db.flush()


async def sync_task_from_linked_shift(db: AsyncSession, shift: PulseScheduleShift) -> None:
    """When a calendar shift row tied to a project task is updated, mirror due date (local UTC date) + assignee."""
    if getattr(shift, "shift_kind", "workforce") != "project_task":
        return
    q = await db.execute(select(PulseProjectTask).where(PulseProjectTask.calendar_shift_id == shift.id))
    task = q.scalar_one_or_none()
    if not task:
        return
    task.assigned_user_id = str(shift.assigned_user_id)
    d = shift.starts_at.date()
    task.due_date = d
    await db.flush()


async def seed_pool_shutdown_if_empty(db: AsyncSession, company_id: str) -> None:
    """Idempotent demo dataset: 3-Week Pool Shutdown + 8 tasks (first company only)."""
    n = await db.scalar(select(func.count()).select_from(PulseProject).where(PulseProject.company_id == company_id))
    if n and int(n) > 0:
        return

    uq = await db.execute(
        select(User.id, User.full_name)
        .where(User.company_id == company_id, User.is_active.is_(True))
        .order_by(User.created_at)
        .limit(5)
    )
    users = uq.all()
    if len(users) < 1:
        return
    uids = [str(r[0]) for r in users]

    today = datetime.now(timezone.utc).date()
    start = today
    end = start + timedelta(weeks=3)

    proj = PulseProject(
        company_id=company_id,
        name="3-Week Pool Shutdown",
        description="Full pool maintenance and safety cycle (demo project).",
        start_date=start,
        end_date=end,
        status=PulseProjectStatus.active,
    )
    db.add(proj)
    await db.flush()

    specs: list[dict[str, Any]] = [
        {"title": "Drain pool", "priority": PulseTaskPriority.high, "status": PulseTaskStatus.complete, "d": 0},
        {"title": "Inspect filtration system", "priority": PulseTaskPriority.critical, "status": PulseTaskStatus.in_progress, "d": 2},
        {"title": "Clean and acid wash", "priority": PulseTaskPriority.medium, "status": PulseTaskStatus.in_progress, "d": 5},
        {"title": "Repair cracks", "priority": PulseTaskPriority.high, "status": PulseTaskStatus.todo, "d": 8},
        {"title": "Replace filters", "priority": PulseTaskPriority.medium, "status": PulseTaskStatus.todo, "d": 11},
        {"title": "Refill pool", "priority": PulseTaskPriority.low, "status": PulseTaskStatus.blocked, "d": 14},
        {"title": "Balance chemicals", "priority": PulseTaskPriority.medium, "status": PulseTaskStatus.todo, "d": 17},
        {"title": "Safety inspection", "priority": PulseTaskPriority.critical, "status": PulseTaskStatus.todo, "d": 20},
    ]

    for i, sp in enumerate(specs):
        uid = uids[i % len(uids)]
        due = start + timedelta(days=int(sp["d"]))
        t = PulseProjectTask(
            company_id=company_id,
            project_id=str(proj.id),
            title=sp["title"],
            description=None,
            assigned_user_id=uid,
            priority=sp["priority"],
            status=sp["status"],
            due_date=due,
        )
        db.add(t)
    await db.flush()

    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.project_id == proj.id))
    for t in tq.scalars().all():
        await ensure_calendar_shift_for_task(db, company_id, t)
