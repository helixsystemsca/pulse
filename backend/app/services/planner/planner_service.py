"""Persistence and orchestration for the Daily Operations Planner."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.planner_models import (
    PlannerBlocker,
    PlannerCalendarEvent,
    PlannerCategory,
    PlannerDailyMetrics,
    PlannerInterruption,
    PlannerRoutineBlock,
    PlannerScheduleBlock,
    PlannerSettings,
    PlannerTask,
    PlannerTaskHistory,
    PlannerTimeEntry,
)
from app.services.planner.calendar_provider import CalendarEvent
from app.services.planner.constants import (
    DEFAULT_CATEGORY_TARGETS,
    DEFAULT_ROUTINE,
    DEFAULT_WEIGHTS,
    DEFAULT_WORK_END,
    DEFAULT_WORK_START,
    DELAY_REASONS,
    HEALTHY_DELAY_REASONS,
    SEED_CATEGORIES,
)
from app.services.planner.scheduling_engine import (
    EngineConfig,
    EngineEvent,
    EngineRoutine,
    EngineTask,
    PlannedBlock,
    at_risk_tasks,
    build_day,
    current_and_next,
    minutes_to_hhmm,
    weekday_offset,
)

TZ_NAME = "America/Vancouver"


def _tz() -> ZoneInfo:
    return ZoneInfo(TZ_NAME)


def _now() -> datetime:
    return datetime.now(_tz())


def _today() -> date:
    return _now().date()


def _parse_date(value: date | str | None) -> date:
    if value is None:
        return _today()
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value)[:10])


def _time_from_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def _as_hhmm(t: time) -> str:
    return f"{t.hour:02d}:{t.minute:02d}"


def _minutes_of(t: time) -> int:
    return t.hour * 60 + t.minute


def _time_from_min(total: int) -> time:
    hhmm = minutes_to_hhmm(total)
    return _time_from_hhmm(hhmm)


class InternalCalendarProvider:
    def __init__(self, db: AsyncSession, company_id: str, user_id: str):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    async def get_events(self, start: datetime, end: datetime) -> list[CalendarEvent]:
        q = await self.db.execute(
            select(PlannerCalendarEvent).where(
                PlannerCalendarEvent.company_id == self.company_id,
                PlannerCalendarEvent.user_id == self.user_id,
                PlannerCalendarEvent.start_at < end,
                PlannerCalendarEvent.end_at > start,
            )
        )
        return [
            CalendarEvent(
                id=str(row.id),
                title=row.title,
                start_at=row.start_at,
                end_at=row.end_at,
                provider=row.provider,
                external_id=row.external_id,
            )
            for row in q.scalars().all()
        ]

    async def create_event(self, title: str, start: datetime, end: datetime) -> CalendarEvent:
        row = PlannerCalendarEvent(
            company_id=self.company_id,
            user_id=self.user_id,
            title=title,
            start_at=start if start.tzinfo else start.replace(tzinfo=_tz()),
            end_at=end if end.tzinfo else end.replace(tzinfo=_tz()),
            provider="internal",
            notes=None,
        )
        self.db.add(row)
        await self.db.flush()
        return CalendarEvent(id=str(row.id), title=row.title, start_at=row.start_at, end_at=row.end_at, provider="internal")

    async def update_event(self, event_id: str, **fields: object) -> CalendarEvent:
        row = await self.db.get(PlannerCalendarEvent, event_id)
        if not row or row.company_id != self.company_id or row.user_id != self.user_id:
            raise ValueError("Calendar event not found")
        for k, v in fields.items():
            if hasattr(row, k) and v is not None:
                setattr(row, k, v)
        await self.db.flush()
        return CalendarEvent(id=str(row.id), title=row.title, start_at=row.start_at, end_at=row.end_at, provider=row.provider)

    async def delete_event(self, event_id: str) -> None:
        row = await self.db.get(PlannerCalendarEvent, event_id)
        if row and row.company_id == self.company_id and row.user_id == self.user_id:
            await self.db.delete(row)
            await self.db.flush()


async def _categories(db: AsyncSession, company_id: str) -> list[PlannerCategory]:
    q = await db.execute(
        select(PlannerCategory)
        .where(PlannerCategory.company_id == company_id, PlannerCategory.active.is_(True))
        .order_by(PlannerCategory.sort_order, PlannerCategory.name)
    )
    return list(q.scalars().all())


async def ensure_defaults(db: AsyncSession, company_id: str, user_id: str) -> None:
    cats = await _categories(db, company_id)
    if not cats:
        for i, (slug, name, color) in enumerate(SEED_CATEGORIES):
            db.add(
                PlannerCategory(
                    company_id=company_id,
                    slug=slug,
                    name=name,
                    color=color,
                    sort_order=i,
                )
            )
        await db.flush()
        cats = await _categories(db, company_id)
    by_slug = {c.slug: c for c in cats}

    settings = (
        await db.execute(
            select(PlannerSettings).where(
                PlannerSettings.company_id == company_id, PlannerSettings.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not settings:
        db.add(
            PlannerSettings(
                company_id=company_id,
                user_id=user_id,
                work_start=_time_from_hhmm(DEFAULT_WORK_START),
                work_end=_time_from_hhmm(DEFAULT_WORK_END),
                category_targets=dict(DEFAULT_CATEGORY_TARGETS),
                scheduler_weights=dict(DEFAULT_WEIGHTS),
                timezone=TZ_NAME,
            )
        )
        await db.flush()

    routines = (
        await db.execute(
            select(PlannerRoutineBlock.id).where(
                PlannerRoutineBlock.company_id == company_id, PlannerRoutineBlock.user_id == user_id
            )
        )
    ).first()
    if not routines:
        for i, (name, slug, start, end, protected, flexible, pri) in enumerate(DEFAULT_ROUTINE):
            cat = by_slug.get(slug)
            if not cat:
                continue
            db.add(
                PlannerRoutineBlock(
                    company_id=company_id,
                    user_id=user_id,
                    category_id=str(cat.id),
                    name=name,
                    start_time=_time_from_hhmm(start),
                    end_time=_time_from_hhmm(end),
                    protected=protected,
                    flexible=flexible,
                    priority=pri,
                    sort_order=i,
                    recurrence="weekdays",
                )
            )
        await db.flush()


def _cat_map(cats: list[PlannerCategory]) -> dict[str, PlannerCategory]:
    return {str(c.id): c for c in cats}


def serialize_task(row: PlannerTask, cats: dict[str, PlannerCategory]) -> dict[str, Any]:
    cat = cats.get(str(row.category_id))
    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "category_id": str(row.category_id),
        "tags": row.tags or [],
        "priority": row.priority,
        "priority_score": row.priority_score,
        "estimated_minutes": row.estimated_minutes,
        "due_date": row.due_date,
        "deadline": row.deadline,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "project_id": row.project_id,
        "asset_id": row.asset_id,
        "person_label": row.person_label,
        "recurrence": row.recurrence,
        "notes": row.notes,
        "status": row.status,
        "delay_count": row.delay_count,
        "started_at": row.started_at,
        "completed_at": row.completed_at,
        "actual_minutes": row.actual_minutes,
        "created_at": row.created_at,
        "category_slug": cat.slug if cat else None,
        "category_name": cat.name if cat else None,
        "category_color": cat.color if cat else None,
    }


def serialize_block(
    row: PlannerScheduleBlock,
    cats: dict[str, PlannerCategory],
    tasks: dict[str, PlannerTask],
    latest_delay: dict[str, str],
) -> dict[str, Any]:
    cat = cats.get(str(row.category_id)) if row.category_id else None
    task = tasks.get(str(row.task_id)) if row.task_id else None
    if task and not cat:
        cat = cats.get(str(task.category_id))
    return {
        "id": str(row.id),
        "date": row.date,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "title": row.title,
        "block_type": row.block_type,
        "locked": row.locked,
        "generated_by_scheduler": row.generated_by_scheduler,
        "status": row.status,
        "task_id": str(row.task_id) if row.task_id else None,
        "calendar_event_id": str(row.calendar_event_id) if row.calendar_event_id else None,
        "routine_block_id": str(row.routine_block_id) if row.routine_block_id else None,
        "category_id": str(row.category_id) if row.category_id else (str(task.category_id) if task else None),
        "category_slug": cat.slug if cat else None,
        "category_name": cat.name if cat else None,
        "category_color": cat.color if cat else None,
        "priority": task.priority if task else None,
        "estimated_minutes": task.estimated_minutes if task else None,
        "source_type": task.source_type if task else ("calendar" if row.block_type == "meeting" else "routine"),
        "delay_count": task.delay_count if task else 0,
        "delay_reason": latest_delay.get(str(row.task_id)) if row.task_id else None,
    }


async def get_settings(db: AsyncSession, company_id: str, user_id: str) -> PlannerSettings:
    await ensure_defaults(db, company_id, user_id)
    row = (
        await db.execute(
            select(PlannerSettings).where(
                PlannerSettings.company_id == company_id, PlannerSettings.user_id == user_id
            )
        )
    ).scalar_one()
    return row


async def patch_settings(
    db: AsyncSession, company_id: str, user_id: str, body: dict[str, Any]
) -> PlannerSettings:
    row = await get_settings(db, company_id, user_id)
    for key in ("work_start", "work_end", "category_targets", "scheduler_weights", "adaptive_scheduling", "timezone"):
        if key in body and body[key] is not None:
            setattr(row, key, body[key])
    await db.flush()
    return row


async def list_categories(db: AsyncSession, company_id: str, user_id: str) -> list[PlannerCategory]:
    await ensure_defaults(db, company_id, user_id)
    return await _categories(db, company_id)


async def list_routines(db: AsyncSession, company_id: str, user_id: str) -> list[PlannerRoutineBlock]:
    await ensure_defaults(db, company_id, user_id)
    q = await db.execute(
        select(PlannerRoutineBlock)
        .where(PlannerRoutineBlock.company_id == company_id, PlannerRoutineBlock.user_id == user_id)
        .order_by(PlannerRoutineBlock.sort_order, PlannerRoutineBlock.start_time)
    )
    return list(q.scalars().all())


async def create_routine(db: AsyncSession, company_id: str, user_id: str, body: dict[str, Any]) -> PlannerRoutineBlock:
    await ensure_defaults(db, company_id, user_id)
    row = PlannerRoutineBlock(company_id=company_id, user_id=user_id, **body)
    db.add(row)
    await db.flush()
    return row


async def patch_routine(
    db: AsyncSession, company_id: str, user_id: str, routine_id: str, body: dict[str, Any]
) -> PlannerRoutineBlock:
    row = await db.get(PlannerRoutineBlock, routine_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Routine block not found")
    for k, v in body.items():
        if v is not None:
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_routine(db: AsyncSession, company_id: str, user_id: str, routine_id: str) -> None:
    row = await db.get(PlannerRoutineBlock, routine_id)
    if row and row.company_id == company_id and row.user_id == user_id:
        await db.delete(row)
        await db.flush()


def _task_filters(company_id: str, user_id: str, status: str | None = None, q: str | None = None) -> list[Any]:
    filters: list[Any] = [PlannerTask.company_id == company_id, PlannerTask.user_id == user_id]
    if status:
        filters.append(PlannerTask.status == status)
    else:
        filters.append(PlannerTask.status.notin_(["cancelled"]))
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(PlannerTask.title.ilike(like), PlannerTask.notes.ilike(like)))
    return filters


async def list_tasks(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    *,
    status: str | None = None,
    q: str | None = None,
) -> list[PlannerTask]:
    await ensure_defaults(db, company_id, user_id)
    stmt = select(PlannerTask).where(*_task_filters(company_id, user_id, status, q)).order_by(
        PlannerTask.status, PlannerTask.due_date.nulls_last(), PlannerTask.created_at.desc()
    )
    return list((await db.execute(stmt)).scalars().all())


async def _resolve_category_id(
    db: AsyncSession, company_id: str, category_id: str | None, category_slug: str | None
) -> str:
    cats = await _categories(db, company_id)
    if category_id:
        if any(str(c.id) == category_id for c in cats):
            return category_id
    slug = (category_slug or "operations").strip().lower()
    for c in cats:
        if c.slug == slug:
            return str(c.id)
    return str(cats[0].id)


async def create_task(db: AsyncSession, company_id: str, user_id: str, body: dict[str, Any]) -> PlannerTask:
    await ensure_defaults(db, company_id, user_id)
    cat_id = await _resolve_category_id(db, company_id, body.get("category_id"), body.get("category_slug"))
    pri = (body.get("priority") or "medium").lower()
    if pri not in {"critical", "high", "medium", "low"}:
        pri = "medium"
    row = PlannerTask(
        company_id=company_id,
        user_id=user_id,
        title=str(body["title"]).strip(),
        description=body.get("description"),
        category_id=cat_id,
        tags=body.get("tags") or [],
        priority=pri,
        priority_score=int(body.get("priority_score") or 0),
        estimated_minutes=max(5, int(body.get("estimated_minutes") or 30)),
        due_date=body.get("due_date"),
        deadline=body.get("deadline"),
        source_type=body.get("source_type") or "manual",
        source_id=body.get("source_id"),
        project_id=body.get("project_id"),
        asset_id=body.get("asset_id"),
        person_label=body.get("person_label"),
        recurrence=body.get("recurrence"),
        notes=body.get("notes"),
    )
    db.add(row)
    await db.flush()
    return row


async def patch_task(
    db: AsyncSession, company_id: str, user_id: str, task_id: str, body: dict[str, Any]
) -> PlannerTask:
    row = await db.get(PlannerTask, task_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Task not found")
    skip = {"category_slug"}
    for k, v in body.items():
        if k in skip or v is None:
            continue
        if k == "priority":
            v = str(v).lower()
        setattr(row, k, v)
    await db.flush()
    return row


async def delete_task(db: AsyncSession, company_id: str, user_id: str, task_id: str) -> None:
    row = await db.get(PlannerTask, task_id)
    if row and row.company_id == company_id and row.user_id == user_id:
        await db.delete(row)
        await db.flush()


async def _open_time_entry(db: AsyncSession, company_id: str, user_id: str, task_id: str | None) -> PlannerTimeEntry:
    row = PlannerTimeEntry(
        company_id=company_id,
        user_id=user_id,
        task_id=task_id,
        start_time=_now(),
    )
    db.add(row)
    await db.flush()
    return row


async def _close_open_entries(db: AsyncSession, company_id: str, user_id: str, task_id: str | None = None) -> int:
    filters = [
        PlannerTimeEntry.company_id == company_id,
        PlannerTimeEntry.user_id == user_id,
        PlannerTimeEntry.end_time.is_(None),
    ]
    if task_id:
        filters.append(PlannerTimeEntry.task_id == task_id)
    rows = list((await db.execute(select(PlannerTimeEntry).where(*filters))).scalars().all())
    total = 0
    now = _now()
    for row in rows:
        row.end_time = now
        mins = max(1, int((now - row.start_time).total_seconds() // 60))
        row.duration_minutes = mins
        total += mins
    await db.flush()
    return total


async def start_task(db: AsyncSession, company_id: str, user_id: str, task_id: str) -> PlannerTask:
    row = await patch_task(db, company_id, user_id, task_id, {"status": "in_progress"})
    if not row.started_at:
        row.started_at = _now()
    await _close_open_entries(db, company_id, user_id)
    await _open_time_entry(db, company_id, user_id, task_id)
    day = _today()
    q = await db.execute(
        select(PlannerScheduleBlock).where(
            PlannerScheduleBlock.company_id == company_id,
            PlannerScheduleBlock.user_id == user_id,
            PlannerScheduleBlock.date == day,
            PlannerScheduleBlock.task_id == task_id,
        )
    )
    for b in q.scalars().all():
        b.status = "in_progress"
    await db.flush()
    return row


async def complete_task(db: AsyncSession, company_id: str, user_id: str, task_id: str) -> PlannerTask:
    row = await db.get(PlannerTask, task_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Task not found")
    added = await _close_open_entries(db, company_id, user_id, task_id)
    row.status = "complete"
    row.completed_at = _now()
    row.actual_minutes = (row.actual_minutes or 0) + added
    q = await db.execute(
        select(PlannerScheduleBlock).where(
            PlannerScheduleBlock.company_id == company_id,
            PlannerScheduleBlock.user_id == user_id,
            PlannerScheduleBlock.task_id == task_id,
        )
    )
    for b in q.scalars().all():
        b.status = "complete"
    if not row.actual_minutes:
        today_blocks = [
            b
            for b in (
                await db.execute(
                    select(PlannerScheduleBlock).where(
                        PlannerScheduleBlock.company_id == company_id,
                        PlannerScheduleBlock.user_id == user_id,
                        PlannerScheduleBlock.date == _today(),
                        PlannerScheduleBlock.task_id == task_id,
                    )
                )
            ).scalars().all()
        ]
        if today_blocks:
            row.actual_minutes = max(
                1,
                max(_minutes_of(b.end_time) - _minutes_of(b.start_time) for b in today_blocks),
            )
        else:
            row.actual_minutes = row.estimated_minutes
    if not row.started_at:
        row.started_at = row.completed_at
    await db.flush()
    await generate_schedule(db, company_id, user_id, _today())
    return row


async def block_task(
    db: AsyncSession, company_id: str, user_id: str, task_id: str, body: dict[str, Any]
) -> PlannerTask:
    row = await patch_task(db, company_id, user_id, task_id, {"status": "blocked"})
    db.add(
        PlannerBlocker(
            company_id=company_id,
            task_id=task_id,
            blocker_type=body.get("blocker_type") or "other",
            description=body.get("description"),
            responsible_party=body.get("responsible_party"),
        )
    )
    await db.flush()
    return row


async def unblock_task(db: AsyncSession, company_id: str, user_id: str, task_id: str) -> PlannerTask:
    row = await patch_task(db, company_id, user_id, task_id, {"status": "not_started"})
    q = await db.execute(
        select(PlannerBlocker).where(PlannerBlocker.task_id == task_id, PlannerBlocker.resolved_at.is_(None))
    )
    now = _now()
    for b in q.scalars().all():
        b.resolved_at = now
    await db.flush()
    return row


async def _latest_delays(db: AsyncSession, company_id: str, task_ids: list[str]) -> dict[str, str]:
    if not task_ids:
        return {}
    q = await db.execute(
        select(PlannerTaskHistory)
        .where(PlannerTaskHistory.company_id == company_id, PlannerTaskHistory.task_id.in_(task_ids))
        .order_by(PlannerTaskHistory.changed_at.desc())
    )
    out: dict[str, str] = {}
    for row in q.scalars().all():
        tid = str(row.task_id)
        if tid not in out:
            out[tid] = row.reason
    return out


async def _adaptive_durations(db: AsyncSession, company_id: str, user_id: str, enabled: bool) -> dict[str, int]:
    if not enabled:
        return {}
    q = await db.execute(
        select(PlannerTask.id, PlannerTask.category_id, PlannerTask.actual_minutes, PlannerTask.estimated_minutes).where(
            PlannerTask.company_id == company_id,
            PlannerTask.user_id == user_id,
            PlannerTask.status == "complete",
            PlannerTask.actual_minutes.is_not(None),
        )
    )
    by_task: dict[str, int] = {}
    by_cat: dict[str, list[int]] = {}
    for tid, cat_id, actual, _est in q.all():
        if actual and actual > 0:
            by_task[str(tid)] = int(actual)
            by_cat.setdefault(str(cat_id), []).append(int(actual))
    cats = {str(c.id): c.slug for c in await _categories(db, company_id)}
    out = dict(by_task)
    for cat_id, vals in by_cat.items():
        slug = cats.get(cat_id)
        if slug and vals:
            out[slug] = round(sum(vals) / len(vals))
    return out


async def generate_schedule(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    day: date | None = None,
) -> list[PlannerScheduleBlock]:
    await ensure_defaults(db, company_id, user_id)
    day = _parse_date(day)
    settings = await get_settings(db, company_id, user_id)
    cats = await _categories(db, company_id)
    cat_by_id = _cat_map(cats)
    slug_to_id = {c.slug: str(c.id) for c in cats}

    existing = list(
        (
            await db.execute(
                select(PlannerScheduleBlock)
                .where(
                    PlannerScheduleBlock.company_id == company_id,
                    PlannerScheduleBlock.user_id == user_id,
                    PlannerScheduleBlock.date == day,
                )
                .order_by(PlannerScheduleBlock.start_time)
            )
        ).scalars().all()
    )
    keep_rows = [
        b
        for b in existing
        if b.status in {"in_progress", "complete"} or (b.locked and not b.generated_by_scheduler)
    ]
    previous_engine = [
        PlannedBlock(
            start_min=_minutes_of(b.start_time),
            end_min=_minutes_of(b.end_time),
            block_type=b.block_type,
            title=b.title,
            category_slug=cat_by_id[str(b.category_id)].slug if b.category_id and str(b.category_id) in cat_by_id else None,
            task_id=str(b.task_id) if b.task_id else None,
            calendar_event_id=str(b.calendar_event_id) if b.calendar_event_id else None,
            locked=b.locked,
        )
        for b in existing
        if b.task_id
    ]

    for b in existing:
        if b in keep_rows:
            continue
        await db.delete(b)
    await db.flush()

    tasks_rows = [
        t
        for t in await list_tasks(db, company_id, user_id)
        if t.status in {"not_started", "in_progress", "deferred"}
    ]
    keep_ids = {str(b.task_id) for b in keep_rows if b.task_id}
    engine_tasks = [
        EngineTask(
            id=str(t.id),
            title=t.title,
            category_slug=cat_by_id[str(t.category_id)].slug if str(t.category_id) in cat_by_id else "operations",
            priority=t.priority,
            priority_score=t.priority_score,
            estimated_minutes=t.estimated_minutes,
            due_date=t.due_date,
            deadline=t.deadline,
            delay_count=t.delay_count,
            waiting_days=max(0, (day - t.created_at.date()).days) if t.created_at else 0,
            status=t.status,
        )
        for t in tasks_rows
        if str(t.id) not in keep_ids
    ]

    routines_rows = [r for r in await list_routines(db, company_id, user_id) if r.active]
    if day.weekday() >= 5:
        routines_rows = [r for r in routines_rows if r.recurrence not in {"weekdays"}]
    engine_routines = [
        EngineRoutine(
            id=str(r.id),
            name=r.name,
            category_slug=cat_by_id[str(r.category_id)].slug if str(r.category_id) in cat_by_id else "operations",
            start_min=_minutes_of(r.start_time),
            end_min=_minutes_of(r.end_time),
            protected=r.protected,
            flexible=r.flexible,
            priority=r.priority,
        )
        for r in routines_rows
    ]

    start_dt = datetime.combine(day, time(0, 0), tzinfo=_tz())
    end_dt = start_dt + timedelta(days=1)
    provider = InternalCalendarProvider(db, company_id, user_id)
    events = await provider.get_events(start_dt, end_dt)
    engine_events = []
    for ev in events:
        local_s = (ev.start_at if ev.start_at.tzinfo else ev.start_at.replace(tzinfo=_tz())).astimezone(_tz())
        local_e = (ev.end_at if ev.end_at.tzinfo else ev.end_at.replace(tzinfo=_tz())).astimezone(_tz())
        if local_s.date() != day and local_e.date() != day:
            continue
        engine_events.append(
            EngineEvent(
                id=ev.id,
                title=ev.title,
                start_min=local_s.hour * 60 + local_s.minute,
                end_min=local_e.hour * 60 + local_e.minute,
            )
        )

    keep_engine = [
        PlannedBlock(
            start_min=_minutes_of(b.start_time),
            end_min=_minutes_of(b.end_time),
            block_type=b.block_type,
            title=b.title,
            category_slug=cat_by_id[str(b.category_id)].slug if b.category_id and str(b.category_id) in cat_by_id else None,
            task_id=str(b.task_id) if b.task_id else None,
            calendar_event_id=str(b.calendar_event_id) if b.calendar_event_id else None,
            locked=True,
            generated=False,
        )
        for b in keep_rows
    ]

    cfg = EngineConfig(
        work_start_min=_minutes_of(settings.work_start),
        work_end_min=_minutes_of(settings.work_end),
        category_targets={str(k): float(v) for k, v in (settings.category_targets or {}).items()},
        weights={str(k): int(v) for k, v in (settings.scheduler_weights or {}).items()} or dict(DEFAULT_WEIGHTS),
        adaptive_durations=await _adaptive_durations(db, company_id, user_id, bool(settings.adaptive_scheduling)),
    )
    planned, displacements = build_day(
        today=day,
        tasks=engine_tasks,
        routines=engine_routines,
        events=engine_events,
        keep=keep_engine,
        cfg=cfg,
        previous=previous_engine,
    )

    keep_keys = {(str(b.task_id), _minutes_of(b.start_time)) for b in keep_rows if b.task_id}
    for pb in planned:
        if pb.task_id and (pb.task_id, pb.start_min) in keep_keys:
            continue
        cat_id = slug_to_id.get(pb.category_slug or "")
        db.add(
            PlannerScheduleBlock(
                company_id=company_id,
                user_id=user_id,
                date=day,
                start_time=_time_from_min(pb.start_min),
                end_time=_time_from_min(pb.end_min),
                task_id=pb.task_id,
                calendar_event_id=pb.calendar_event_id,
                routine_block_id=pb.routine_block_id,
                category_id=cat_id,
                title=pb.title,
                block_type=pb.block_type,
                locked=pb.locked,
                generated_by_scheduler=pb.generated,
                status="complete"
                if any(k.task_id == pb.task_id and k.status == "complete" for k in keep_rows)
                else "in_progress"
                if any(k.task_id == pb.task_id and k.status == "in_progress" for k in keep_rows)
                else "scheduled",
            )
        )

    for d in displacements:
        task = await db.get(PlannerTask, d.task_id)
        if not task or task.status in {"complete", "cancelled"}:
            continue
        task.delay_count = int(task.delay_count or 0) + 1
        db.add(
            PlannerTaskHistory(
                company_id=company_id,
                task_id=d.task_id,
                previous_date=d.previous_date,
                previous_start=_time_from_min(d.previous_start_min) if d.previous_start_min is not None else None,
                new_date=d.new_date,
                new_start=_time_from_min(d.new_start_min) if d.new_start_min is not None else None,
                reason=d.reason if d.reason in DELAY_REASONS else "other",
                source=d.source,
            )
        )
    await db.flush()
    await persist_daily_metrics(db, company_id, user_id, day)
    return await _day_blocks(db, company_id, user_id, day)


async def _day_blocks(
    db: AsyncSession, company_id: str, user_id: str, day: date
) -> list[PlannerScheduleBlock]:
    q = await db.execute(
        select(PlannerScheduleBlock)
        .where(
            PlannerScheduleBlock.company_id == company_id,
            PlannerScheduleBlock.user_id == user_id,
            PlannerScheduleBlock.date == day,
        )
        .order_by(PlannerScheduleBlock.start_time)
    )
    return list(q.scalars().all())


async def get_day(
    db: AsyncSession, company_id: str, user_id: str, day: date | None = None, *, generate_if_empty: bool = True
) -> dict[str, Any]:
    await ensure_defaults(db, company_id, user_id)
    day = _parse_date(day)
    blocks = await _day_blocks(db, company_id, user_id, day)
    if generate_if_empty and not blocks:
        blocks = await generate_schedule(db, company_id, user_id, day)
    settings = await get_settings(db, company_id, user_id)
    cats = _cat_map(await _categories(db, company_id))
    task_ids = [str(b.task_id) for b in blocks if b.task_id]
    tasks_q = await db.execute(select(PlannerTask).where(PlannerTask.id.in_(task_ids))) if task_ids else None
    tasks = {str(t.id): t for t in (tasks_q.scalars().all() if tasks_q else [])}
    delays = await _latest_delays(db, company_id, task_ids)
    timeline = [serialize_block(b, cats, tasks, delays) for b in blocks]

    now = _now()
    now_min = now.hour * 60 + now.minute if now.date() == day else -1
    engine_blocks = [
        PlannedBlock(
            start_min=_minutes_of(b.start_time),
            end_min=_minutes_of(b.end_time),
            block_type=b.block_type,
            title=b.title,
            task_id=str(b.task_id) if b.task_id else None,
        )
        for b in blocks
    ]
    cur, nxt = current_and_next(engine_blocks, now_min if now_min >= 0 else 24 * 60)
    cur_out = next((x for x in timeline if x["task_id"] == (cur.task_id if cur else None) and cur and _minutes_of(x["start_time"]) == cur.start_min), None)
    if cur and not cur_out:
        cur_out = next((x for x in timeline if _minutes_of(x["start_time"]) == cur.start_min), None)
    nxt_out = None
    if nxt:
        nxt_out = next((x for x in timeline if _minutes_of(x["start_time"]) == nxt.start_min), None)

    all_tasks = await list_tasks(db, company_id, user_id)
    engine_tasks = [
        EngineTask(
            id=str(t.id),
            title=t.title,
            category_slug=cats[str(t.category_id)].slug if str(t.category_id) in cats else "operations",
            priority=t.priority,
            priority_score=t.priority_score,
            estimated_minutes=t.estimated_minutes,
            due_date=t.due_date,
            deadline=t.deadline,
            delay_count=t.delay_count,
            waiting_days=0,
            status=t.status,
        )
        for t in all_tasks
    ]
    risk = at_risk_tasks(engine_tasks, day, {str(b.task_id) for b in blocks if b.task_id})
    risk_rows = [t for t in all_tasks if str(t.id) in {r.id for r in risk}]

    metrics = await persist_daily_metrics(db, company_id, user_id, day)
    open_int = (
        await db.execute(
            select(PlannerInterruption).where(
                PlannerInterruption.company_id == company_id,
                PlannerInterruption.user_id == user_id,
                PlannerInterruption.end_time.is_(None),
            )
        )
    ).scalar_one_or_none()

    return {
        "date": day,
        "day_label": day.strftime("%A"),
        "work_start": settings.work_start,
        "work_end": settings.work_end,
        "completion_pct": metrics.completion_pct if metrics else 0,
        "now": cur_out,
        "next": nxt_out,
        "at_risk": [serialize_task(t, cats) for t in risk_rows],
        "timeline": timeline,
        "open_interruption": open_int,
        "metrics": {
            "completed_count": metrics.completed_count if metrics else 0,
            "scheduled_count": metrics.scheduled_count if metrics else 0,
            "delayed_count": metrics.delayed_count if metrics else 0,
            "blocked_count": metrics.blocked_count if metrics else 0,
            "interruption_minutes": metrics.interruption_minutes if metrics else 0,
            "meeting_minutes": metrics.meeting_minutes if metrics else 0,
            "strategic_minutes": metrics.strategic_minutes if metrics else 0,
            "delay_reasons": metrics.delay_reasons if metrics else {},
        },
    }


async def persist_daily_metrics(
    db: AsyncSession, company_id: str, user_id: str, day: date
) -> PlannerDailyMetrics:
    blocks = await _day_blocks(db, company_id, user_id, day)
    cats = _cat_map(await _categories(db, company_id))
    task_ids = [str(b.task_id) for b in blocks if b.task_id]
    tasks = {}
    if task_ids:
        tasks = {str(t.id): t for t in (await db.execute(select(PlannerTask).where(PlannerTask.id.in_(task_ids)))).scalars().all()}
    completed = sum(1 for t in tasks.values() if t.status == "complete")
    scheduled = sum(1 for b in blocks if b.block_type == "task")
    blocked = sum(1 for t in tasks.values() if t.status == "blocked")
    hist = list(
        (
            await db.execute(
                select(PlannerTaskHistory).where(
                    PlannerTaskHistory.company_id == company_id,
                    PlannerTaskHistory.changed_at >= datetime.combine(day, time.min, tzinfo=_tz()),
                    PlannerTaskHistory.changed_at < datetime.combine(day + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    delay_reasons: dict[str, int] = {}
    for h in hist:
        delay_reasons[h.reason] = delay_reasons.get(h.reason, 0) + 1
    meeting_min = sum(_minutes_of(b.end_time) - _minutes_of(b.start_time) for b in blocks if b.block_type == "meeting")
    strategic_min = 0
    cat_minutes: dict[str, int] = {}
    for b in blocks:
        mins = max(0, _minutes_of(b.end_time) - _minutes_of(b.start_time))
        slug = None
        if b.category_id and str(b.category_id) in cats:
            slug = cats[str(b.category_id)].slug
        elif b.task_id and str(b.task_id) in tasks:
            cat = cats.get(str(tasks[str(b.task_id)].category_id))
            slug = cat.slug if cat else None
        if slug:
            cat_minutes[slug] = cat_minutes.get(slug, 0) + mins
            if slug == "strategic":
                strategic_min += mins
    ints = list(
        (
            await db.execute(
                select(PlannerInterruption).where(
                    PlannerInterruption.company_id == company_id,
                    PlannerInterruption.user_id == user_id,
                    PlannerInterruption.start_time >= datetime.combine(day, time.min, tzinfo=_tz()),
                    PlannerInterruption.start_time < datetime.combine(day + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    interrupt_min = sum(int(i.duration_minutes or 0) for i in ints)
    pct = round((completed / scheduled) * 100, 1) if scheduled else 0.0
    row = (
        await db.execute(
            select(PlannerDailyMetrics).where(
                PlannerDailyMetrics.company_id == company_id,
                PlannerDailyMetrics.user_id == user_id,
                PlannerDailyMetrics.date == day,
            )
        )
    ).scalar_one_or_none()
    if not row:
        row = PlannerDailyMetrics(company_id=company_id, user_id=user_id, date=day)
        db.add(row)
    row.completed_count = completed
    row.scheduled_count = scheduled
    row.delayed_count = len(hist)
    row.blocked_count = blocked
    row.interruption_minutes = interrupt_min
    row.meeting_minutes = meeting_min
    row.strategic_minutes = strategic_min
    row.completion_pct = pct
    row.category_minutes = cat_minutes
    row.delay_reasons = delay_reasons
    await db.flush()
    return row


async def closeout_day(
    db: AsyncSession, company_id: str, user_id: str, day: date | None, notes: str | None
) -> PlannerDailyMetrics:
    day = _parse_date(day)
    row = await persist_daily_metrics(db, company_id, user_id, day)
    if notes is not None:
        row.notes = notes
        await db.flush()
    return row


async def start_interruption(
    db: AsyncSession, company_id: str, user_id: str, body: dict[str, Any]
) -> PlannerInterruption:
    current = (
        await db.execute(
            select(PlannerTask).where(
                PlannerTask.company_id == company_id,
                PlannerTask.user_id == user_id,
                PlannerTask.status == "in_progress",
            )
        )
    ).scalars().first()
    paused = str(current.id) if current else None
    if current:
        await _close_open_entries(db, company_id, user_id, str(current.id))
        current.status = "deferred"
    row = PlannerInterruption(
        company_id=company_id,
        user_id=user_id,
        reason=body.get("reason") or "emergency",
        notes=body.get("notes"),
        category_id=body.get("category_id"),
        create_work_request=bool(body.get("create_work_request")),
        paused_task_id=paused,
        start_time=_now(),
    )
    db.add(row)
    await db.flush()
    now = _now()
    start_t = time(now.hour, now.minute)
    end_t = _time_from_min(min(24 * 60 - 1, _minutes_of(start_t) + 1))
    db.add(
        PlannerScheduleBlock(
            company_id=company_id,
            user_id=user_id,
            date=now.date(),
            start_time=start_t,
            end_time=end_t,
            interruption_id=str(row.id),
            category_id=body.get("category_id"),
            title=(body.get("notes") or body.get("reason") or "Emergency").replace("_", " ").title(),
            block_type="interruption",
            locked=True,
            generated_by_scheduler=False,
            status="in_progress",
        )
    )
    await db.flush()
    return row


async def end_interruption(
    db: AsyncSession, company_id: str, user_id: str, interruption_id: str
) -> PlannerInterruption:
    row = await db.get(PlannerInterruption, interruption_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Interruption not found")
    now = _now()
    row.end_time = now
    row.duration_minutes = max(1, int((now - row.start_time).total_seconds() // 60))
    q = await db.execute(
        select(PlannerScheduleBlock).where(
            PlannerScheduleBlock.company_id == company_id,
            PlannerScheduleBlock.user_id == user_id,
            PlannerScheduleBlock.interruption_id == interruption_id,
        )
    )
    for b in q.scalars().all():
        b.end_time = time(now.hour, now.minute)
        b.status = "complete"
    if row.paused_task_id:
        paused = await db.get(PlannerTask, row.paused_task_id)
        if paused and paused.status == "deferred":
            paused.status = "in_progress"
            await _open_time_entry(db, company_id, user_id, str(paused.id))
    await db.flush()
    await generate_schedule(db, company_id, user_id, _today())
    return row


async def defer_task(
    db: AsyncSession, company_id: str, user_id: str, task_id: str, reason: str, notes: str | None
) -> PlannerTask:
    row = await patch_task(db, company_id, user_id, task_id, {"status": "deferred"})
    row.delay_count = int(row.delay_count or 0) + 1
    db.add(
        PlannerTaskHistory(
            company_id=company_id,
            task_id=task_id,
            previous_date=_today(),
            new_date=weekday_offset(_today()),
            reason=reason if reason in DELAY_REASONS else "personal_manual",
            source="manual",
            notes=notes,
        )
    )
    await db.flush()
    await generate_schedule(db, company_id, user_id, _today())
    return row


async def move_block(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    block_id: str,
    start: time,
    end: time | None,
    reason: str,
) -> PlannerScheduleBlock:
    row = await db.get(PlannerScheduleBlock, block_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Block not found")
    prev = row.start_time
    duration = _minutes_of(row.end_time) - _minutes_of(row.start_time)
    row.start_time = start
    row.end_time = end or _time_from_min(_minutes_of(start) + max(5, duration))
    row.generated_by_scheduler = False
    row.locked = True
    if row.task_id:
        task = await db.get(PlannerTask, row.task_id)
        if task:
            task.delay_count = int(task.delay_count or 0) + 1
        db.add(
            PlannerTaskHistory(
                company_id=company_id,
                task_id=row.task_id,
                previous_date=row.date,
                previous_start=prev,
                new_date=row.date,
                new_start=row.start_time,
                reason=reason if reason in DELAY_REASONS else "personal_manual",
                source="manual",
            )
        )
    await db.flush()
    return row


async def lock_block(db: AsyncSession, company_id: str, user_id: str, block_id: str, locked: bool) -> PlannerScheduleBlock:
    row = await db.get(PlannerScheduleBlock, block_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Block not found")
    row.locked = locked
    if locked:
        row.generated_by_scheduler = False
    await db.flush()
    return row


async def accept_schedule(
    db: AsyncSession, company_id: str, user_id: str, day: date | None = None
) -> list[PlannerScheduleBlock]:
    day = _parse_date(day)
    blocks = await _day_blocks(db, company_id, user_id, day)
    for b in blocks:
        if b.block_type == "meeting":
            b.locked = True
            continue
        b.locked = True
        b.generated_by_scheduler = False
    await db.flush()
    return blocks


async def stop_task(db: AsyncSession, company_id: str, user_id: str, task_id: str) -> PlannerTask:
    row = await db.get(PlannerTask, task_id)
    if not row or row.company_id != company_id or row.user_id != user_id:
        raise ValueError("Task not found")
    added = await _close_open_entries(db, company_id, user_id, task_id)
    row.actual_minutes = (row.actual_minutes or 0) + added
    if row.status == "in_progress":
        row.status = "not_started"
    await db.flush()
    return row


async def list_history(db: AsyncSession, company_id: str, task_id: str) -> list[PlannerTaskHistory]:
    q = await db.execute(
        select(PlannerTaskHistory)
        .where(PlannerTaskHistory.company_id == company_id, PlannerTaskHistory.task_id == task_id)
        .order_by(PlannerTaskHistory.changed_at.desc())
    )
    return list(q.scalars().all())


async def analytics(
    db: AsyncSession, company_id: str, user_id: str, *, start: date, end: date, compare: bool = True
) -> dict[str, Any]:
    await ensure_defaults(db, company_id, user_id)
    q = await db.execute(
        select(PlannerDailyMetrics).where(
            PlannerDailyMetrics.company_id == company_id,
            PlannerDailyMetrics.user_id == user_id,
            PlannerDailyMetrics.date >= start,
            PlannerDailyMetrics.date <= end,
        )
    )
    rows = list(q.scalars().all())
    span = max(1, (end - start).days + 1)

    def rollup(items: list[PlannerDailyMetrics]) -> dict[str, Any]:
        completed = sum(r.completed_count for r in items)
        scheduled = sum(r.scheduled_count for r in items)
        delayed = sum(r.delayed_count for r in items)
        blocked = sum(r.blocked_count for r in items)
        interrupt = sum(r.interruption_minutes for r in items)
        meetings = sum(r.meeting_minutes for r in items)
        cat: dict[str, int] = {}
        reasons: dict[str, int] = {}
        for r in items:
            for k, v in (r.category_minutes or {}).items():
                cat[str(k)] = cat.get(str(k), 0) + int(v or 0)
            for k, v in (r.delay_reasons or {}).items():
                reasons[str(k)] = reasons.get(str(k), 0) + int(v or 0)
        total_cat = sum(cat.values()) or 1
        allocation = {k: round(v * 100 / total_cat, 1) for k, v in sorted(cat.items(), key=lambda kv: -kv[1])}
        return {
            "completed": completed,
            "scheduled": scheduled,
            "completion_pct": round((completed / scheduled) * 100, 1) if scheduled else 0,
            "delayed": delayed,
            "blocked": blocked,
            "interruption_minutes": interrupt,
            "meeting_minutes": meetings,
            "category_minutes": cat,
            "allocation_pct": allocation,
            "delay_reasons": reasons,
        }

    current = rollup(rows)
    comparison: dict[str, Any] = {}
    if compare:
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span - 1)
        pq = await db.execute(
            select(PlannerDailyMetrics).where(
                PlannerDailyMetrics.company_id == company_id,
                PlannerDailyMetrics.user_id == user_id,
                PlannerDailyMetrics.date >= prev_start,
                PlannerDailyMetrics.date <= prev_end,
            )
        )
        comparison = {"previous": rollup(list(pq.scalars().all())), "previous_start": prev_start, "previous_end": prev_end}

    hist = list(
        (
            await db.execute(
                select(PlannerTaskHistory).where(
                    PlannerTaskHistory.company_id == company_id,
                    PlannerTaskHistory.changed_at >= datetime.combine(start, time.min, tzinfo=_tz()),
                    PlannerTaskHistory.changed_at < datetime.combine(end + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    healthy = sum(1 for h in hist if h.reason in HEALTHY_DELAY_REASONS)
    process = len(hist) - healthy

    blockers = list(
        (
            await db.execute(
                select(PlannerBlocker).where(
                    PlannerBlocker.company_id == company_id,
                    PlannerBlocker.started_at >= datetime.combine(start, time.min, tzinfo=_tz()),
                    PlannerBlocker.started_at < datetime.combine(end + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    blocker_types: dict[str, int] = {}
    parties: dict[str, int] = {}
    for b in blockers:
        blocker_types[b.blocker_type] = blocker_types.get(b.blocker_type, 0) + 1
        if b.responsible_party:
            parties[b.responsible_party] = parties.get(b.responsible_party, 0) + 1

    completed_tasks = list(
        (
            await db.execute(
                select(PlannerTask).where(
                    PlannerTask.company_id == company_id,
                    PlannerTask.user_id == user_id,
                    PlannerTask.status == "complete",
                    PlannerTask.completed_at >= datetime.combine(start, time.min, tzinfo=_tz()),
                    PlannerTask.completed_at < datetime.combine(end + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    on_time = 0
    dur_pairs: list[tuple[int, int]] = []
    for t in completed_tasks:
        due = t.deadline or t.due_date
        if t.completed_at and (due is None or t.completed_at.date() <= due):
            on_time += 1
        if t.actual_minutes and t.estimated_minutes:
            dur_pairs.append((t.estimated_minutes, t.actual_minutes))
    avg_est = round(sum(a for a, _ in dur_pairs) / len(dur_pairs), 1) if dur_pairs else 0
    avg_act = round(sum(b for _, b in dur_pairs) / len(dur_pairs), 1) if dur_pairs else 0

    carried = list(
        (
            await db.execute(
                select(PlannerTask).where(
                    PlannerTask.company_id == company_id,
                    PlannerTask.user_id == user_id,
                    PlannerTask.status.in_(["not_started", "deferred", "in_progress"]),
                    PlannerTask.delay_count > 0,
                )
            )
        ).scalars().all()
    )
    repeated = [t for t in carried if t.delay_count >= 2]

    insights: list[str] = []
    if current["meeting_minutes"] >= 60 and current["delayed"]:
        insights.append(
            f"Meetings used {current['meeting_minutes']} minutes and {current['delayed']} scheduled tasks were displaced in this period."
        )
    if process and process > healthy:
        insights.append(
            f"{process} delays look like process/wait issues versus {healthy} healthy operational delays."
        )
    if current["interruption_minutes"] >= 30:
        insights.append(f"Reactive interruptions consumed {current['interruption_minutes']} minutes.")
    alloc = current["allocation_pct"]
    targets = (await get_settings(db, company_id, user_id)).category_targets or {}
    for slug, target in targets.items():
        have = float(alloc.get(slug, 0)) / 100
        if target and have + 0.03 < float(target):
            insights.append(
                f"{slug.replace('_', ' ').title()} time is below target ({round(have * 100, 1)}% vs {round(float(target) * 100, 1)}%)."
            )
    if parties:
        top_party, n = max(parties.items(), key=lambda kv: kv[1])
        insights.append(f"{top_party} is associated with {n} blocked item(s).")
    if repeated:
        insights.append(f"{len(repeated)} task(s) have been deferred two or more times.")

    ints = list(
        (
            await db.execute(
                select(PlannerInterruption).where(
                    PlannerInterruption.company_id == company_id,
                    PlannerInterruption.user_id == user_id,
                    PlannerInterruption.start_time >= datetime.combine(start, time.min, tzinfo=_tz()),
                    PlannerInterruption.start_time < datetime.combine(end + timedelta(days=1), time.min, tzinfo=_tz()),
                )
            )
        ).scalars().all()
    )
    int_reasons: dict[str, int] = {}
    for i in ints:
        int_reasons[i.reason] = int_reasons.get(i.reason, 0) + 1
    avg_int = round(sum(int(i.duration_minutes or 0) for i in ints) / len(ints), 1) if ints else 0

    return {
        "range_label": f"{start.isoformat()} – {end.isoformat()}",
        "start": start,
        "end": end,
        "productivity": {
            "tasks_completed": current["completed"],
            "completion_pct": current["completion_pct"],
            "on_time_pct": round((on_time / len(completed_tasks)) * 100, 1) if completed_tasks else 0,
            "avg_estimated_minutes": avg_est,
            "avg_actual_minutes": avg_act,
            "carried_forward": len(carried),
            "repeatedly_deferred": len(repeated),
            "meeting_minutes": current["meeting_minutes"],
            "strategic_minutes": sum(r.strategic_minutes for r in rows),
        },
        "time_allocation": current["allocation_pct"],
        "interruptions": {
            "total_minutes": current["interruption_minutes"],
            "count": len(ints),
            "average_minutes": avg_int,
            "by_reason": int_reasons,
        },
        "delays": {
            "count": current["delayed"],
            "by_reason": current["delay_reasons"],
            "healthy": healthy,
            "process": process,
        },
        "blockers": {
            "count": len(blockers),
            "by_type": blocker_types,
            "by_party": parties,
        },
        "insights": insights,
        "comparison": comparison,
    }


def analytics_csv(payload: dict[str, Any]) -> str:
    lines = ["section,key,value"]
    for section in ("productivity", "time_allocation", "interruptions", "delays", "blockers"):
        data = payload.get(section) or {}
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, dict):
                    for k2, v2 in v.items():
                        lines.append(f"{section},{k}.{k2},{v2}")
                else:
                    lines.append(f"{section},{k},{v}")
    for i, insight in enumerate(payload.get("insights") or []):
        safe = str(insight).replace(",", ";")
        lines.append(f"insights,{i},{safe}")
    return "\n".join(lines) + "\n"


def list_email_suggestions() -> list[dict[str, Any]]:
    """MVP: no email connector. Outlook/Gmail later implement EmailProvider."""
    return []
