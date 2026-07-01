"""Worker development persistence, quadrant automation, timeline & history."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.user_avatar_upload import co_worker_avatar_url
from app.models.domain import User
from app.models.pulse_models import PulseWorkerDevelopment, PulseWorkerHR, PulseWorkerSkill
from app.services.worker_development.templates import (
    DEFAULT_STATUS_BY_QUADRANT,
    QUADRANT_LABELS,
    build_plan_from_template,
)

VALID_QUADRANTS = frozenset({"A", "B", "C", "D"})
REVIEW_OFFSETS_DAYS = (30, 60, 90)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _default_career() -> dict[str, Any]:
    return {
        "desired_position": None,
        "leadership_interest": None,
        "promotion_readiness": None,
        "mentor_user_id": None,
        "mentor_name": None,
        "career_notes": None,
    }


def _serialize_career(raw: Any) -> dict[str, Any]:
    base = _default_career()
    if isinstance(raw, dict):
        base.update({k: raw.get(k) for k in base})
    return base


def _serialize_recognitions(raw: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        at_raw = item.get("at")
        try:
            at_dt = datetime.fromisoformat(str(at_raw).replace("Z", "+00:00")) if at_raw else _utcnow()
        except ValueError:
            at_dt = _utcnow()
        out.append(
            {
                "id": str(item.get("id") or uuid4()),
                "at": at_dt.isoformat(),
                "title": str(item.get("title") or "Recognition"),
                "description": item.get("description"),
                "awarded_by": item.get("awarded_by"),
                "awarded_by_user_id": item.get("awarded_by_user_id"),
                "category": str(item.get("category") or "other"),
            },
        )
    return out


def _build_unified_history(
    history: list[Any],
    recognitions: list[Any],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for h in _serialize_history(history):
        items.append({**h, "at": h["at"].isoformat() if isinstance(h["at"], datetime) else h["at"], "source": "development"})
    for r in _serialize_recognitions(recognitions):
        items.append(
            {
                "id": r["id"],
                "at": r["at"],
                "kind": "recognition",
                "summary": r["title"],
                "detail": r.get("description"),
                "source": "recognition",
            },
        )
    items.sort(key=lambda x: str(x.get("at") or ""), reverse=True)
    return items


def _plan_completion_pct(timeline: list[Any]) -> float:
    if not timeline:
        return 0.0
    done = sum(1 for t in timeline if isinstance(t, dict) and t.get("status") == "completed")
    return round(100.0 * done / len(timeline), 1)


def _default_assessment() -> dict[str, Any]:
    return {
        "strengths": "",
        "development_areas": "",
        "leadership_potential": None,
        "engagement": None,
        "reliability": None,
        "communication": None,
        "initiative": None,
        "technical_skills": None,
        "overall_summary": "",
    }


def _normalize_quadrant(value: Optional[str]) -> str:
    q = (value or "C").strip().upper()
    return q if q in VALID_QUADRANTS else "C"


def _skills_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict) and item.get("name"):
            out.append(str(item["name"]).strip())
    return out


def _append_history(
    history: list[Any],
    *,
    kind: str,
    summary: str,
    detail: Optional[str] = None,
    at: Optional[datetime] = None,
) -> list[Any]:
    entry = {
        "id": str(uuid4()),
        "at": (at or _utcnow()).isoformat(),
        "kind": kind,
        "summary": summary,
        "detail": detail,
    }
    return [entry, *history]


def _build_timeline_from_plan(plan: dict[str, Any], *, base: Optional[date] = None) -> list[dict[str, Any]]:
    start = base or date.today()
    items: list[dict[str, Any]] = [
        {
            "id": str(uuid4()),
            "kind": "plan_created",
            "title": "Development Plan Created",
            "scheduled_date": start.isoformat(),
            "status": "completed",
            "notes": None,
            "attachments": [],
        },
    ]
    for offset in REVIEW_OFFSETS_DAYS:
        review_date = start + timedelta(days=offset)
        items.append(
            {
                "id": str(uuid4()),
                "kind": "review",
                "title": f"{offset} Day Review",
                "scheduled_date": review_date.isoformat(),
                "status": "pending",
                "notes": None,
                "attachments": [],
            },
        )
    return items


def _next_review_from_timeline(timeline: list[dict[str, Any]]) -> Optional[date]:
    today = date.today()
    pending: list[date] = []
    for item in timeline:
        if item.get("status") == "completed":
            continue
        raw = item.get("scheduled_date")
        if not raw:
            continue
        try:
            d = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        if d >= today:
            pending.append(d)
    return min(pending) if pending else None


def _scores_from_assessment(assessment: dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    perf_keys = ("reliability", "technical_skills", "initiative")
    pot_keys = ("leadership_potential", "engagement")
    perf_vals = [assessment.get(k) for k in perf_keys if isinstance(assessment.get(k), (int, float))]
    pot_vals = [assessment.get(k) for k in pot_keys if isinstance(assessment.get(k), (int, float))]
    perf = round(sum(perf_vals) / len(perf_vals), 1) if perf_vals else None
    pot = round(sum(pot_vals) / len(pot_vals), 1) if pot_vals else None
    return perf, pot


def _plan_has_content(plan: dict[str, Any]) -> bool:
    if not plan:
        return False
    milestones = plan.get("milestones") or {}
    if isinstance(milestones, dict) and any(milestones.values()):
        return True
    return bool(plan.get("objective") or plan.get("custom_notes"))


async def get_or_create_development(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
) -> PulseWorkerDevelopment:
    row = await db.get(PulseWorkerDevelopment, user_id)
    if row and str(row.company_id) == str(company_id):
        return row
    if row and str(row.company_id) != str(company_id):
        raise ValueError("development record company mismatch")
    now = _utcnow()
    plan = build_plan_from_template("C", generated_at_iso=now.isoformat())
    timeline = _build_timeline_from_plan(plan)
    row = PulseWorkerDevelopment(
        user_id=user_id,
        company_id=company_id,
        development_quadrant="C",
        development_status=DEFAULT_STATUS_BY_QUADRANT["C"],
        assessment=_default_assessment(),
        development_plan=plan,
        skills=[],
        timeline=timeline,
        history=[],
        next_review_date=_next_review_from_timeline(timeline),
    )
    db.add(row)
    await db.flush()
    return row


async def _supervisor_name_map(db: AsyncSession, supervisor_ids: list[str]) -> dict[str, str]:
    if not supervisor_ids:
        return {}
    q = await db.execute(select(User.id, User.full_name, User.email).where(User.id.in_(supervisor_ids)))
    out: dict[str, str] = {}
    for uid, name, email in q.all():
        out[str(uid)] = (name or email or "").strip()
    return out


async def _roster_skills_map(db: AsyncSession, company_id: str, user_ids: list[str]) -> dict[str, list[str]]:
    if not user_ids:
        return {}
    q = await db.execute(
        select(PulseWorkerSkill.user_id, PulseWorkerSkill.name).where(
            PulseWorkerSkill.company_id == company_id,
            PulseWorkerSkill.user_id.in_(user_ids),
        )
    )
    out: dict[str, list[str]] = {}
    for uid, name in q.all():
        key = str(uid)
        out.setdefault(key, []).append(name)
    return out


def _serialize_timeline(raw: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "id": str(item.get("id") or uuid4()),
                "kind": str(item.get("kind") or "custom"),
                "title": str(item.get("title") or "Milestone"),
                "scheduled_date": item.get("scheduled_date"),
                "status": str(item.get("status") or "pending"),
                "notes": item.get("notes"),
                "attachments": item.get("attachments") if isinstance(item.get("attachments"), list) else [],
            },
        )
    return out


def _serialize_history(raw: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        at_raw = item.get("at")
        try:
            at_dt = datetime.fromisoformat(str(at_raw).replace("Z", "+00:00")) if at_raw else _utcnow()
        except ValueError:
            at_dt = _utcnow()
        out.append(
            {
                "id": str(item.get("id") or uuid4()),
                "at": at_dt,
                "kind": str(item.get("kind") or "update"),
                "summary": str(item.get("summary") or ""),
                "detail": item.get("detail"),
            },
        )
    return out


def summary_from_row(
    user: User,
    hr: Optional[PulseWorkerHR],
    dev: PulseWorkerDevelopment,
    *,
    supervisor_name: Optional[str] = None,
    roster_skills: Optional[list[str]] = None,
) -> dict[str, Any]:
    assessment = dict(dev.assessment or {})
    perf, pot = _scores_from_assessment(assessment)
    summary_text = (assessment.get("overall_summary") or "").strip() or None
    return {
        "user_id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "job_title": hr.job_title if hr else None,
        "department": hr.department if hr else None,
        "avatar_url": co_worker_avatar_url(str(user.id), user.avatar_url),
        "supervisor_id": str(hr.supervisor_user_id) if hr and hr.supervisor_user_id else None,
        "supervisor_name": supervisor_name,
        "start_date": hr.start_date if hr else None,
        "is_active": user.is_active,
        "development_quadrant": _normalize_quadrant(dev.development_quadrant),
        "development_status": dev.development_status or DEFAULT_STATUS_BY_QUADRANT["C"],
        "last_assessment_at": dev.last_assessment_at,
        "next_review_date": dev.next_review_date,
        "assessment_summary": summary_text,
        "performance_score": perf,
        "potential_score": pot,
        "roster_skills": roster_skills or [],
    }


def detail_from_row(
    user: User,
    hr: Optional[PulseWorkerHR],
    dev: PulseWorkerDevelopment,
    *,
    supervisor_name: Optional[str] = None,
    roster_skills: Optional[list[str]] = None,
) -> dict[str, Any]:
    base = summary_from_row(user, hr, dev, supervisor_name=supervisor_name, roster_skills=roster_skills)
    assessment = {**_default_assessment(), **(dev.assessment or {})}
    plan = dict(dev.development_plan or {})
    recognitions = _serialize_recognitions(dev.recognitions or [])
    history = _serialize_history(dev.history or [])
    return {
        **base,
        "manager_notes": dev.manager_notes,
        "career_goals": dev.career_goals,
        "assessment": assessment,
        "development_plan": plan,
        "skills": _skills_list(dev.skills),
        "timeline": _serialize_timeline(dev.timeline or []),
        "history": history,
        "career": _serialize_career(dev.career if hasattr(dev, "career") else {}),
        "recognitions": recognitions,
        "unified_history": _build_unified_history(dev.history or [], dev.recognitions or []),
        "plan_completion_pct": _plan_completion_pct(dev.timeline or []),
        "updated_at": dev.updated_at,
    }


async def list_development_summaries(
    db: AsyncSession,
    *,
    company_id: str,
    users: list[User],
    hr_map: dict[str, PulseWorkerHR],
) -> list[dict[str, Any]]:
    if not users:
        return []
    user_ids = [str(u.id) for u in users]
    q = await db.execute(
        select(PulseWorkerDevelopment).where(
            PulseWorkerDevelopment.company_id == company_id,
            PulseWorkerDevelopment.user_id.in_(user_ids),
        )
    )
    dev_map = {str(d.user_id): d for d in q.scalars().all()}
    supervisor_ids = [
        str(hr.supervisor_user_id)
        for hr in hr_map.values()
        if hr and hr.supervisor_user_id
    ]
    sup_names = await _supervisor_name_map(db, list(set(supervisor_ids)))
    skills_map = await _roster_skills_map(db, company_id, user_ids)

    items: list[dict[str, Any]] = []
    last_updated: Optional[datetime] = None
    for user in users:
        uid = str(user.id)
        dev = dev_map.get(uid)
        if not dev:
            dev = await get_or_create_development(db, company_id=company_id, user_id=uid)
        hr = hr_map.get(uid)
        sup_name = None
        if hr and hr.supervisor_user_id:
            sup_name = sup_names.get(str(hr.supervisor_user_id))
        items.append(
            summary_from_row(
                user,
                hr,
                dev,
                supervisor_name=sup_name,
                roster_skills=skills_map.get(uid, []),
            ),
        )
        if dev.updated_at and (last_updated is None or dev.updated_at > last_updated):
            last_updated = dev.updated_at
    await db.flush()
    return items, last_updated


async def get_development_detail(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    hr: Optional[PulseWorkerHR],
) -> dict[str, Any]:
    dev = await get_or_create_development(db, company_id=company_id, user_id=str(user.id))
    sup_name = None
    if hr and hr.supervisor_user_id:
        names = await _supervisor_name_map(db, [str(hr.supervisor_user_id)])
        sup_name = names.get(str(hr.supervisor_user_id))
    skills_map = await _roster_skills_map(db, company_id, [str(user.id)])
    return detail_from_row(
        user,
        hr,
        dev,
        supervisor_name=sup_name,
        roster_skills=skills_map.get(str(user.id), []),
    )


async def patch_development(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    hr: Optional[PulseWorkerHR],
    payload: dict[str, Any],
) -> tuple[dict[str, Any], bool, Optional[str]]:
    """Returns (detail, plan_overwrite_required, message)."""
    dev = await get_or_create_development(db, company_id=company_id, user_id=str(user.id))
    plan_overwrite_required = False
    message: Optional[str] = None

    new_quadrant = payload.get("development_quadrant")
    if new_quadrant is not None:
        new_q = _normalize_quadrant(new_quadrant)
        old_q = _normalize_quadrant(dev.development_quadrant)
        if new_q != old_q:
            has_plan = _plan_has_content(dev.development_plan or {})
            if has_plan and not payload.get("confirm_plan_overwrite"):
                detail = await get_development_detail(db, company_id=company_id, user=user, hr=hr)
                return detail, True, "Changing quadrant will replace the current development plan. Confirm to continue."

            now = _utcnow()
            dev.development_quadrant = new_q
            dev.development_status = payload.get("development_status") or DEFAULT_STATUS_BY_QUADRANT.get(new_q, "developing")
            plan = build_plan_from_template(new_q, generated_at_iso=now.isoformat())
            dev.development_plan = plan
            dev.timeline = _build_timeline_from_plan(plan)
            dev.next_review_date = _next_review_from_timeline(dev.timeline)
            dev.history = _append_history(
                list(dev.history or []),
                kind="quadrant_change",
                summary=f"Moved from {old_q} → {new_q}",
                detail=f"Quadrant updated to {QUADRANT_LABELS.get(new_q, new_q)}.",
                at=now,
            )

    if payload.get("development_status") is not None and new_quadrant is None:
        dev.development_status = payload["development_status"]

    if payload.get("manager_notes") is not None:
        dev.manager_notes = payload["manager_notes"]

    if payload.get("career_goals") is not None:
        dev.career_goals = payload["career_goals"]

    if payload.get("skills") is not None:
        dev.skills = _skills_list(payload["skills"])

    if payload.get("assessment") is not None:
        merged = {**_default_assessment(), **(dev.assessment or {}), **payload["assessment"]}
        dev.assessment = merged
        if payload.get("record_assessment"):
            now = _utcnow()
            dev.last_assessment_at = now
            dev.history = _append_history(
                list(dev.history or []),
                kind="assessment",
                summary="Assessment completed",
                at=now,
            )

    if payload.get("development_plan") is not None:
        incoming = payload["development_plan"]
        if isinstance(incoming, dict):
            dev.development_plan = {**(dev.development_plan or {}), **incoming}
            dev.history = _append_history(
                list(dev.history or []),
                kind="plan_update",
                summary="Development plan updated",
            )

    if payload.get("timeline") is not None:
        raw_timeline = payload["timeline"]
        if isinstance(raw_timeline, list):
            dev.timeline = [
                {
                    "id": str(item.get("id") or uuid4()),
                    "kind": item.get("kind", "custom"),
                    "title": item.get("title", "Milestone"),
                    "scheduled_date": item.get("scheduled_date"),
                    "status": item.get("status", "pending"),
                    "notes": item.get("notes"),
                    "attachments": item.get("attachments") if isinstance(item.get("attachments"), list) else [],
                }
                for item in raw_timeline
                if isinstance(item, dict)
            ]
            dev.next_review_date = _next_review_from_timeline(dev.timeline)

    if payload.get("career") is not None and isinstance(payload["career"], dict):
        dev.career = {**_serialize_career(dev.career if hasattr(dev, "career") else {}), **payload["career"]}

    if payload.get("add_recognition") is not None:
        rec_in = payload["add_recognition"]
        if isinstance(rec_in, dict) and rec_in.get("title"):
            now = _utcnow()
            rec = {
                "id": str(uuid4()),
                "at": now.isoformat(),
                "title": rec_in["title"],
                "description": rec_in.get("description"),
                "awarded_by": rec_in.get("awarded_by"),
                "awarded_by_user_id": rec_in.get("awarded_by_user_id"),
                "category": rec_in.get("category") or "other",
            }
            dev.recognitions = [rec, *list(dev.recognitions or [])]
            dev.history = _append_history(
                list(dev.history or []),
                kind="recognition",
                summary=f"Recognition: {rec['title']}",
                detail=rec.get("description"),
                at=now,
            )

    detail = await get_development_detail(db, company_id=company_id, user=user, hr=hr)
    return detail, plan_overwrite_required, message


async def list_recognition_feed(
    db: AsyncSession,
    *,
    company_id: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    q = await db.execute(
        select(PulseWorkerDevelopment, User.full_name, User.email).join(
            User, User.id == PulseWorkerDevelopment.user_id
        ).where(PulseWorkerDevelopment.company_id == company_id)
    )
    feed: list[dict[str, Any]] = []
    for dev, full_name, email in q.all():
        for rec in _serialize_recognitions(dev.recognitions or []):
            feed.append(
                {
                    "id": rec["id"],
                    "user_id": str(dev.user_id),
                    "employee_name": (full_name or email or "").strip(),
                    "at": rec["at"],
                    "title": rec["title"],
                    "description": rec.get("description"),
                    "category": rec.get("category") or "other",
                    "awarded_by": rec.get("awarded_by"),
                },
            )
    feed.sort(key=lambda x: str(x.get("at") or ""), reverse=True)
    return feed[:limit]


# Extension hooks (calendar, AI coaching, succession) — implement later.
class DevelopmentAutomationHooks:
    """Placeholder registry for future integrations."""

    calendar_providers: list[str] = []
    reminder_channels: list[str] = []
