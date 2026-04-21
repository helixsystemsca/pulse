"""
Subscribe to domain events and grant operational XP (separate DB session per event).

Canonical event types (extend by publishing from feature code):

- ``ops.work_request_assigned`` — lead/supervisor assignment + optional 24h responsiveness bonus.
- ``pulse.schedule_shift_created`` — supervisor planning bonus (shift starts ≥48h after creation).
- ``ops.supervisor_one_on_one`` — weekly-capped 1:1 log (see ``POST /api/v1/supervisor/one-on-one``).
- ``ops.review_submitted`` — optional; metadata: ``review_id``, ``user_id`` (reviewee), ``rating`` (≥4 for XP).

Task completion XP stays synchronous on ``POST /tasks/{id}/complete`` (ledger dedupe ``task_completion:{task_id}``).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.database import AsyncSessionLocal
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import User
from app.services.xp_grant import try_grant_xp
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
