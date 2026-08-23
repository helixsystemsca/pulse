"""Daily Operations Planner HTTP API."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.schemas.planner import (
    PlannerAnalyticsOut,
    PlannerBlockerIn,
    PlannerCalendarEventIn,
    PlannerCalendarEventOut,
    PlannerCategoryOut,
    PlannerCloseoutIn,
    PlannerDayOut,
    PlannerDeferIn,
    PlannerHistoryOut,
    PlannerInterruptionIn,
    PlannerInterruptionOut,
    PlannerMoveIn,
    PlannerRoutineIn,
    PlannerRoutineOut,
    PlannerRoutinePatchIn,
    PlannerSettingsOut,
    PlannerSettingsPatchIn,
    PlannerTaskIn,
    PlannerTaskOut,
    PlannerTaskPatchIn,
)
from app.services.planner import planner_service as svc
from app.services.planner.constants import DELAY_REASONS, HEALTHY_DELAY_REASONS, TASK_STATUSES

router = APIRouter(prefix="/planner", tags=["daily-planner"])

Db = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[User, Depends(require_any_rbac("daily_planner.view", "daily_planner.manage"))]
Editor = Annotated[User, Depends(require_any_rbac("daily_planner.manage"))]


def _cid(actor: User) -> str:
    if not actor.company_id:
        raise HTTPException(400, "No company on session")
    return str(actor.company_id)


def _uid(actor: User) -> str:
    return str(actor.id)


def _task_out(row: Any, cats: dict) -> PlannerTaskOut:
    return PlannerTaskOut.model_validate(svc.serialize_task(row, cats))


@router.get("/meta")
async def meta(_: Reader) -> dict[str, Any]:
    return {
        "delay_reasons": list(DELAY_REASONS),
        "healthy_delay_reasons": sorted(HEALTHY_DELAY_REASONS),
        "priorities": ["critical", "high", "medium", "low"],
        "statuses": list(TASK_STATUSES),
        "calendar_provider": "internal",
        "email_provider": None,
        "source_types": [
            "manual",
            "project",
            "work_request",
            "pm",
            "inspection",
            "procedure",
            "asset",
            "compliance",
            "training",
            "inventory",
            "schedule",
            "meeting",
            "calendar",
            "email",
        ],
    }


@router.get("/categories", response_model=list[PlannerCategoryOut])
async def categories(db: Db, actor: Actor, _: Reader) -> list[PlannerCategoryOut]:
    rows = await svc.list_categories(db, _cid(actor), _uid(actor))
    await db.commit()
    return [PlannerCategoryOut.model_validate(r) for r in rows]


@router.get("/settings", response_model=PlannerSettingsOut)
async def get_settings(db: Db, actor: Actor, _: Reader) -> PlannerSettingsOut:
    row = await svc.get_settings(db, _cid(actor), _uid(actor))
    await db.commit()
    return PlannerSettingsOut.model_validate(row)


@router.patch("/settings", response_model=PlannerSettingsOut)
async def patch_settings(body: PlannerSettingsPatchIn, db: Db, actor: Actor, _: Editor) -> PlannerSettingsOut:
    row = await svc.patch_settings(db, _cid(actor), _uid(actor), body.model_dump(exclude_unset=True))
    await db.commit()
    return PlannerSettingsOut.model_validate(row)


@router.get("/routine", response_model=list[PlannerRoutineOut])
async def list_routine(db: Db, actor: Actor, _: Reader) -> list[PlannerRoutineOut]:
    rows = await svc.list_routines(db, _cid(actor), _uid(actor))
    await db.commit()
    return [PlannerRoutineOut.model_validate(r) for r in rows]


@router.post("/routine", response_model=PlannerRoutineOut)
async def create_routine(body: PlannerRoutineIn, db: Db, actor: Actor, _: Editor) -> PlannerRoutineOut:
    row = await svc.create_routine(db, _cid(actor), _uid(actor), body.model_dump())
    await db.commit()
    return PlannerRoutineOut.model_validate(row)


@router.patch("/routine/{routine_id}", response_model=PlannerRoutineOut)
async def patch_routine(
    routine_id: str, body: PlannerRoutinePatchIn, db: Db, actor: Actor, _: Editor
) -> PlannerRoutineOut:
    try:
        row = await svc.patch_routine(db, _cid(actor), _uid(actor), routine_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    await db.commit()
    return PlannerRoutineOut.model_validate(row)


@router.delete("/routine/{routine_id}", status_code=204)
async def delete_routine(routine_id: str, db: Db, actor: Actor, _: Editor) -> Response:
    await svc.delete_routine(db, _cid(actor), _uid(actor), routine_id)
    await db.commit()
    return Response(status_code=204)


@router.get("/tasks", response_model=list[PlannerTaskOut])
async def list_tasks(
    db: Db,
    actor: Actor,
    _: Reader,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> list[PlannerTaskOut]:
    cid, uid = _cid(actor), _uid(actor)
    rows = await svc.list_tasks(db, cid, uid, status=status, q=q)
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return [_task_out(r, cats) for r in rows]


@router.post("/tasks", response_model=PlannerTaskOut)
async def create_task(body: PlannerTaskIn, db: Db, actor: Actor, _: Editor) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    row = await svc.create_task(db, cid, uid, body.model_dump())
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.patch("/tasks/{task_id}", response_model=PlannerTaskOut)
async def patch_task(
    task_id: str, body: PlannerTaskPatchIn, db: Db, actor: Actor, _: Editor
) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.patch_task(db, cid, uid, task_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, db: Db, actor: Actor, _: Editor) -> Response:
    await svc.delete_task(db, _cid(actor), _uid(actor), task_id)
    await db.commit()
    return Response(status_code=204)


@router.post("/tasks/{task_id}/start", response_model=PlannerTaskOut)
async def start_task(task_id: str, db: Db, actor: Actor, _: Editor) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.start_task(db, cid, uid, task_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.post("/tasks/{task_id}/stop", response_model=PlannerTaskOut)
async def stop_task(task_id: str, db: Db, actor: Actor, _: Editor) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.stop_task(db, cid, uid, task_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.post("/tasks/{task_id}/complete", response_model=PlannerTaskOut)
async def complete_task(task_id: str, db: Db, actor: Actor, _: Editor) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.complete_task(db, cid, uid, task_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.post("/tasks/{task_id}/defer", response_model=PlannerTaskOut)
async def defer_task(
    task_id: str, body: PlannerDeferIn, db: Db, actor: Actor, _: Editor
) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    row = await svc.defer_task(db, cid, uid, task_id, body.reason, body.notes)
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.post("/tasks/{task_id}/block", response_model=PlannerTaskOut)
async def block_task(
    task_id: str, body: PlannerBlockerIn, db: Db, actor: Actor, _: Editor
) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.block_task(db, cid, uid, task_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.post("/tasks/{task_id}/unblock", response_model=PlannerTaskOut)
async def unblock_task(task_id: str, db: Db, actor: Actor, _: Editor) -> PlannerTaskOut:
    cid, uid = _cid(actor), _uid(actor)
    try:
        row = await svc.unblock_task(db, cid, uid, task_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    cats = {str(c.id): c for c in await svc.list_categories(db, cid, uid)}
    await db.commit()
    return _task_out(row, cats)


@router.get("/tasks/{task_id}/history", response_model=list[PlannerHistoryOut])
async def task_history(task_id: str, db: Db, actor: Actor, _: Reader) -> list[PlannerHistoryOut]:
    rows = await svc.list_history(db, _cid(actor), task_id)
    return [
        PlannerHistoryOut.model_validate(r).model_copy(update={"healthy": r.reason in HEALTHY_DELAY_REASONS})
        for r in rows
    ]


@router.get("/day", response_model=PlannerDayOut)
async def get_day(
    db: Db,
    actor: Actor,
    _: Reader,
    date_value: Optional[date] = Query(None, alias="date"),
) -> PlannerDayOut:
    data = await svc.get_day(db, _cid(actor), _uid(actor), date_value)
    payload = PlannerDayOut.model_validate(data)
    await db.commit()
    return payload


@router.post("/day/generate", response_model=PlannerDayOut)
async def generate_day(
    db: Db,
    actor: Actor,
    _: Editor,
    date_value: Optional[date] = Query(None, alias="date"),
) -> PlannerDayOut:
    cid, uid = _cid(actor), _uid(actor)
    await svc.generate_schedule(db, cid, uid, date_value)
    data = await svc.get_day(db, cid, uid, date_value, generate_if_empty=False)
    payload = PlannerDayOut.model_validate(data)
    await db.commit()
    return payload


@router.post("/day/accept")
async def accept_day(
    db: Db,
    actor: Actor,
    _: Editor,
    date_value: Optional[date] = Query(None, alias="date"),
) -> dict[str, str]:
    await svc.accept_schedule(db, _cid(actor), _uid(actor), date_value)
    await db.commit()
    return {"ok": "true"}


@router.post("/day/closeout")
async def closeout(
    body: PlannerCloseoutIn,
    db: Db,
    actor: Actor,
    _: Editor,
    date_value: Optional[date] = Query(None, alias="date"),
) -> dict[str, Any]:
    row = await svc.closeout_day(db, _cid(actor), _uid(actor), date_value, body.notes)
    await db.commit()
    return {
        "date": row.date,
        "completed_count": row.completed_count,
        "completion_pct": row.completion_pct,
        "delayed_count": row.delayed_count,
        "blocked_count": row.blocked_count,
        "interruption_minutes": row.interruption_minutes,
        "meeting_minutes": row.meeting_minutes,
        "strategic_minutes": row.strategic_minutes,
        "delay_reasons": row.delay_reasons,
        "notes": row.notes,
    }


@router.post("/blocks/{block_id}/move")
async def move_block(block_id: str, body: PlannerMoveIn, db: Db, actor: Actor, _: Editor) -> dict[str, str]:
    try:
        await svc.move_block(db, _cid(actor), _uid(actor), block_id, body.start_time, body.end_time, body.reason)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    await db.commit()
    return {"ok": "true"}


@router.post("/blocks/{block_id}/lock")
async def lock_block(
    block_id: str, db: Db, actor: Actor, _: Editor, locked: bool = True
) -> dict[str, str]:
    try:
        await svc.lock_block(db, _cid(actor), _uid(actor), block_id, locked)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    await db.commit()
    return {"ok": "true"}


@router.post("/interruptions", response_model=PlannerInterruptionOut)
async def start_interruption(
    body: PlannerInterruptionIn, db: Db, actor: Actor, _: Editor
) -> PlannerInterruptionOut:
    row = await svc.start_interruption(db, _cid(actor), _uid(actor), body.model_dump())
    await db.commit()
    return PlannerInterruptionOut.model_validate(row)


@router.post("/interruptions/{interruption_id}/end", response_model=PlannerInterruptionOut)
async def end_interruption(
    interruption_id: str, db: Db, actor: Actor, _: Editor
) -> PlannerInterruptionOut:
    try:
        row = await svc.end_interruption(db, _cid(actor), _uid(actor), interruption_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    await db.commit()
    return PlannerInterruptionOut.model_validate(row)


@router.post("/calendar/events", response_model=PlannerCalendarEventOut)
async def create_event(
    body: PlannerCalendarEventIn, db: Db, actor: Actor, _: Editor
) -> PlannerCalendarEventOut:
    provider = svc.InternalCalendarProvider(db, _cid(actor), _uid(actor))
    ev = await provider.create_event(body.title, body.start_at, body.end_at)
    if body.notes:
        await provider.update_event(ev.id, notes=body.notes)
    await svc.generate_schedule(db, _cid(actor), _uid(actor), body.start_at.date())
    await db.commit()
    return PlannerCalendarEventOut(
        id=ev.id, provider=ev.provider, title=ev.title, start_at=ev.start_at, end_at=ev.end_at, notes=body.notes
    )


@router.delete("/calendar/events/{event_id}", status_code=204)
async def delete_event(event_id: str, db: Db, actor: Actor, _: Editor) -> Response:
    provider = svc.InternalCalendarProvider(db, _cid(actor), _uid(actor))
    await provider.delete_event(event_id)
    await svc.generate_schedule(db, _cid(actor), _uid(actor), svc._today())
    await db.commit()
    return Response(status_code=204)


@router.get("/email-suggestions")
async def email_suggestions(_: Reader) -> list[dict[str, Any]]:
    return svc.list_email_suggestions()


@router.get("/analytics", response_model=PlannerAnalyticsOut)
async def analytics(
    db: Db,
    actor: Actor,
    _: Reader,
    start: Optional[date] = None,
    end: Optional[date] = None,
    range_name: str = Query("week", alias="range"),
) -> PlannerAnalyticsOut:
    today = svc._today()
    if range_name == "month":
        start = start or today.replace(day=1)
        end = end or today
    elif range_name == "quarter":
        qmonth = ((today.month - 1) // 3) * 3 + 1
        start = start or today.replace(month=qmonth, day=1)
        end = end or today
    elif range_name == "year":
        start = start or today.replace(month=1, day=1)
        end = end or today
    else:
        start = start or (today - timedelta(days=6))
        end = end or today
    payload = await svc.analytics(db, _cid(actor), _uid(actor), start=start, end=end)
    await db.commit()
    return PlannerAnalyticsOut.model_validate(payload)


@router.get("/analytics/export")
async def analytics_export(
    db: Db,
    actor: Actor,
    _: Reader,
    start: Optional[date] = None,
    end: Optional[date] = None,
    range_name: str = Query("week", alias="range"),
) -> Response:
    today = svc._today()
    if range_name == "month":
        start = start or today.replace(day=1)
        end = end or today
    elif range_name == "quarter":
        qmonth = ((today.month - 1) // 3) * 3 + 1
        start = start or today.replace(month=qmonth, day=1)
        end = end or today
    elif range_name == "year":
        start = start or today.replace(month=1, day=1)
        end = end or today
    else:
        start = start or (today - timedelta(days=6))
        end = end or today
    payload = await svc.analytics(db, _cid(actor), _uid(actor), start=start, end=end)
    csv = svc.analytics_csv(payload)
    await db.commit()
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=planner-analytics.csv"},
    )
