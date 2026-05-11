"""
Subscribe to domain events and grant operational XP (separate DB session per event).

Canonical event types (extend by publishing from feature code):

- ``ops.work_request_assigned`` — lead/supervisor assignment + optional 24h responsiveness bonus.
- ``pulse.schedule_shift_created`` — supervisor planning bonus (shift starts ≥48h after creation).
- ``ops.supervisor_one_on_one`` — weekly-capped 1:1 log (see ``POST /api/v1/supervisor/one-on-one``).
- ``ops.review_submitted`` — optional; metadata: ``review_id``, ``user_id`` (reviewee), ``rating`` (≥4 for XP).
- ``ops.inference_confirmed`` / ``demo_inference_confirmed`` — proactive maintenance inference confirmation.
- ``ops.procedure_completed`` — procedure assignment finished (optional ``all_steps_completed``).
- ``ops.pm_completed_on_time`` — PM gamified task completed before due (``pm_task_id`` in metadata).
- ``schedule.shift_started`` — worker acknowledged shift start (attendance XP; dedupe per day).
- ``ops.inspection_sheet_completed`` — inspection sheet submitted.
- ``ops.task_reopened`` — removes quality-bonus XP (ledger-backed cap; fallback −15 if no breakdown).
- ``ops.task_flagged`` — removes quality-bonus XP when breakdown exists; resets ``no_flags`` named streak.

Task completion XP stays synchronous on ``POST /tasks/{id}/complete`` (ledger dedupe ``task_completion:{task_id}``).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.services.streak_service import apply_named_streak, apply_named_streak_break

from app.core.database import AsyncSessionLocal
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import User
from app.models.gamification_models import UserStats
from app.services.xp_grant import quality_bonus_xp_for_task, try_grant_xp
from app.services.xp_role_policy import assigner_operational_track

_logger = logging.getLogger(__name__)
_xp_subs_attached = False


def _parse_ts(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    s = str(raw).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


async def _on_work_request_assigned(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    assigner = md.get("assigned_by_user_id")
    assignee = md.get("assigned_user_id")
    wr_id = md.get("work_request_id")
    if not assigner or not assignee or not wr_id:
        return
    if str(assigner) == str(assignee):
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(assigner))
        if not u or str(u.company_id) != cid:
            return
        track = assigner_operational_track(u)
        if not track:
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(assigner),
            track=track,  # type: ignore[arg-type]
            amount=12,
            reason_code="work_request_assigned",
            dedupe_key=f"wr_assign:{wr_id}",
            meta={"work_request_id": str(wr_id), "assignee": str(assignee)},
            reason="Work request assigned",
        )
        created = _parse_ts(md.get("work_request_created_at"))
        assigned_at = _parse_ts(md.get("assigned_at")) or datetime.now(timezone.utc)
        if created and (assigned_at - created).total_seconds() <= 86400:
            await try_grant_xp(
                db,
                company_id=cid,
                user_id=str(assigner),
                track=track,  # type: ignore[arg-type]
                amount=8,
                reason_code="assignment_responsive_24h",
                dedupe_key=f"wr_assign_resp:{wr_id}",
                meta={"work_request_id": str(wr_id)},
                reason="Assignment within 24 hours",
            )
        await db.commit()


async def _on_schedule_shift_created(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    uid = md.get("created_by_user_id")
    shift_id = md.get("shift_id")
    starts = _parse_ts(md.get("starts_at"))
    created = _parse_ts(md.get("created_at")) or datetime.now(timezone.utc)
    if not uid or not shift_id or not starts:
        return
    cid = str(ev.company_id)
    ahead_h = (starts - created).total_seconds() / 3600.0
    if ahead_h < 48.0:
        return
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(uid))
        if not u or str(u.company_id) != cid:
            return
        if not _is_supervisor(u):
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(uid),
            track="supervisor",
            amount=15,
            reason_code="schedule_shift_planned_ahead",
            dedupe_key=f"shift_plan:{shift_id}",
            meta={"shift_id": str(shift_id)},
            reason="Shift scheduled 48h+ ahead",
        )
        await db.commit()


def _is_supervisor(u: User) -> bool:
    from app.core.user_roles import user_has_any_role
    from app.models.domain import UserRole

    return user_has_any_role(u, UserRole.supervisor)


async def _on_supervisor_one_on_one(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    sup = md.get("supervisor_user_id")
    emp = md.get("employee_user_id")
    week = md.get("iso_week_key")
    if not sup or not emp or not week:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(sup))
        if not u or str(u.company_id) != cid or not _is_supervisor(u):
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(sup),
            track="supervisor",
            amount=18,
            reason_code="supervisor_one_on_one",
            dedupe_key=f"121:{sup}:{emp}:{week}",
            meta={"employee_user_id": str(emp)},
            reason="Supervisor 1-on-1 logged",
        )
        await db.commit()


async def _on_review_submitted(ev: DomainEvent) -> None:
    """Grant supervisors when they receive strong peer/employee feedback."""
    md = ev.metadata or {}
    reviewee = md.get("user_id")
    rating = md.get("rating")
    review_id = md.get("review_id")
    if not reviewee or rating is None or not review_id:
        return
    try:
        r = int(rating)
    except (TypeError, ValueError):
        return
    if r < 4:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(reviewee))
        if not u or str(u.company_id) != cid or not _is_supervisor(u):
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(reviewee),
            track="supervisor",
            amount=10 + min(10, r - 4) * 2,
            reason_code="employee_feedback_score",
            dedupe_key=f"review:{review_id}",
            meta={"rating": r},
            reason=f"Strong employee feedback (rating {r})",
        )
        await db.commit()


async def _on_inference_confirmed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("confirmed_by") or md.get("worker_id")
    inference_id = md.get("inference_id") or str(ev.entity_id or "")
    equipment_id = md.get("equipment_id") or "unknown"
    if not worker_id or not inference_id:
        return
    cid = str(ev.company_id)
    today = datetime.now(timezone.utc).date().isoformat()
    dedupe = f"inference_confirm:{worker_id}:{equipment_id}:{today}"
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(worker_id),
            track="worker",
            amount=25,
            reason_code="inference_confirmed",
            dedupe_key=dedupe,
            meta={"inference_id": str(inference_id), "equipment_id": str(equipment_id)},
            reason="Maintenance confirmed proactively",
        )
        await db.commit()


async def _on_procedure_completed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("completed_by") or md.get("worker_id")
    proc_id = md.get("procedure_id") or str(ev.entity_id or "")
    all_steps = bool(md.get("all_steps_completed", False))
    if not worker_id or not proc_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        g1 = await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(worker_id),
            track="worker",
            amount=30,
            reason_code="procedure_completed",
            dedupe_key=f"proc_complete:{proc_id}:{worker_id}",
            meta={"procedure_id": str(proc_id), "all_steps": all_steps},
            reason="Procedure completed",
            category="procedure",
            source_type="procedure",
            source_id=str(proc_id),
        )
        if all_steps:
            await try_grant_xp(
                db,
                company_id=cid,
                user_id=str(worker_id),
                track="worker",
                amount=10,
                reason_code="procedure_all_steps",
                dedupe_key=f"proc_allsteps:{proc_id}:{worker_id}",
                meta={"procedure_id": str(proc_id)},
                reason="All procedure steps completed",
                apply_badges=False,
                apply_streak=False,
                category="procedure",
                source_type="procedure",
                source_id=str(proc_id),
            )
        if int(g1.applied or 0) > 0:
            st = await db.get(UserStats, str(worker_id))
            if st and str(st.company_id) == cid:
                st.procedures_completed = int(getattr(st, "procedures_completed", 0) or 0) + 1
        await db.commit()


async def _on_pm_completed_on_time(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("completed_by") or md.get("worker_id")
    pm_task_id = md.get("pm_task_id") or str(ev.entity_id or "")
    if not worker_id or not pm_task_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(worker_id),
            track="worker",
            amount=20,
            reason_code="pm_completed_on_time",
            dedupe_key=f"pm_ontime:{pm_task_id}:{worker_id}",
            meta={"pm_task_id": str(pm_task_id)},
            reason="Preventive maintenance completed on time",
        )
        await apply_named_streak(
            db,
            company_id=cid,
            user_id=str(worker_id),
            streak_type="pm_on_time",
            activity_day=datetime.now(timezone.utc).date(),
        )
        await db.commit()


async def _on_shift_started(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("assigned_user_id") or md.get("worker_id")
    shift_id = md.get("shift_id") or str(ev.entity_id or "")
    if not worker_id or not shift_id:
        return
    today = datetime.now(timezone.utc).date().isoformat()
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(worker_id),
            track="worker",
            amount=5,
            reason_code="attendance_clock_in",
            dedupe_key=f"attendance:{worker_id}:{today}",
            meta={"shift_id": str(shift_id)},
            reason="Shift started on time",
        )
        await apply_named_streak(
            db,
            company_id=cid,
            user_id=str(worker_id),
            streak_type="shift_attendance",
            activity_day=datetime.now(timezone.utc).date(),
        )
        await db.commit()


async def _on_task_reopened(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    task_id = md.get("task_id") or str(ev.entity_id or "")
    user_id = md.get("assigned_to")
    if not task_id or not user_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        qb = await quality_bonus_xp_for_task(db, company_id=cid, user_id=str(user_id), task_id=str(task_id))
        rev = qb if qb > 0 else 15
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(user_id),
            track="worker",
            amount=-rev,
            reason_code="task_reopen_penalty",
            dedupe_key=f"task_reopen_penalty:{task_id}",
            meta={"task_id": str(task_id)},
            reason="Task reopened — quality bonus removed",
            apply_badges=False,
            apply_streak=False,
        )
        await db.commit()


async def _on_task_flagged(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    task_id = md.get("task_id") or str(ev.entity_id or "")
    user_id = md.get("flagged_user_id") or md.get("assigned_to")
    if not task_id or not user_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        qb = await quality_bonus_xp_for_task(db, company_id=cid, user_id=str(user_id), task_id=str(task_id))
        if qb > 0:
            await try_grant_xp(
                db,
                company_id=cid,
                user_id=str(user_id),
                track="worker",
                amount=-qb,
                reason_code="flag_bonus_reversal",
                dedupe_key=f"flag_reversal:{task_id}:{user_id}",
                meta={"task_id": str(task_id)},
                reason="Task flagged — quality bonus removed",
                apply_badges=False,
                apply_streak=False,
            )
        await apply_named_streak_break(db, company_id=cid, user_id=str(user_id), streak_type="no_flags")
        await db.commit()


async def _on_inspection_completed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("completed_by") or md.get("worker_id")
    sheet_id = md.get("sheet_id") or str(ev.entity_id or "")
    if not worker_id or not sheet_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(worker_id),
            track="worker",
            amount=20,
            reason_code="inspection_sheet_completed",
            dedupe_key=f"inspection:{sheet_id}:{worker_id}",
            meta={"sheet_id": str(sheet_id)},
            reason="Inspection submitted",
        )
        await db.commit()


def attach_xp_event_subscribers() -> None:
    """Register XP handlers once (avoids duplicate grants under uvicorn --reload)."""
    global _xp_subs_attached
    if _xp_subs_attached:
        return
    _xp_subs_attached = True
    event_engine.subscribe("ops.work_request_assigned", _on_work_request_assigned)
    event_engine.subscribe("pulse.schedule_shift_created", _on_schedule_shift_created)
    event_engine.subscribe("ops.supervisor_one_on_one", _on_supervisor_one_on_one)
    event_engine.subscribe("ops.review_submitted", _on_review_submitted)
    event_engine.subscribe("ops.inference_confirmed", _on_inference_confirmed)
    event_engine.subscribe("demo_inference_confirmed", _on_inference_confirmed)
    event_engine.subscribe("ops.procedure_completed", _on_procedure_completed)
    event_engine.subscribe("ops.pm_completed_on_time", _on_pm_completed_on_time)
    event_engine.subscribe("schedule.shift_started", _on_shift_started)
    event_engine.subscribe("ops.inspection_sheet_completed", _on_inspection_completed)
    event_engine.subscribe("ops.task_reopened", _on_task_reopened)
    event_engine.subscribe("ops.task_flagged", _on_task_flagged)
