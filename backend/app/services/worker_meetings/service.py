"""Worker meetings and action items."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import PulseMeetingActionItem, PulseWorkerMeeting


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _name_map(db: AsyncSession, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    q = await db.execute(select(User.id, User.full_name, User.email).where(User.id.in_(user_ids)))
    out: dict[str, str] = {}
    for uid, name, email in q.all():
        out[str(uid)] = (name or email or "").strip()
    return out


async def _action_items_for_meetings(
    db: AsyncSession,
    meeting_ids: list[str],
) -> dict[str, list[PulseMeetingActionItem]]:
    if not meeting_ids:
        return {}
    q = await db.execute(
        select(PulseMeetingActionItem).where(PulseMeetingActionItem.meeting_id.in_(meeting_ids))
    )
    out: dict[str, list[PulseMeetingActionItem]] = {}
    for row in q.scalars().all():
        if row.meeting_id:
            out.setdefault(str(row.meeting_id), []).append(row)
    return out


def _serialize_action_item(row: PulseMeetingActionItem, names: dict[str, str]) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "meeting_id": str(row.meeting_id) if row.meeting_id else None,
        "employee_user_id": str(row.employee_user_id),
        "assigned_to_user_id": str(row.assigned_to_user_id) if row.assigned_to_user_id else None,
        "assigned_to_name": names.get(str(row.assigned_to_user_id or "")),
        "title": row.title,
        "due_date": row.due_date,
        "status": row.status,
        "notes": row.notes,
        "project_id": str(row.project_id) if row.project_id else None,
    }


def _serialize_meeting(
    row: PulseWorkerMeeting,
    *,
    employee_name: Optional[str],
    manager_name: Optional[str],
    action_items: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "employee_user_id": str(row.employee_user_id),
        "employee_name": employee_name,
        "manager_user_id": str(row.manager_user_id) if row.manager_user_id else None,
        "manager_name": manager_name,
        "meeting_type": row.meeting_type,
        "scheduled_date": row.scheduled_date,
        "status": row.status,
        "agenda": row.agenda,
        "wins": row.wins,
        "challenges": row.challenges,
        "goals": row.goals,
        "manager_notes": row.manager_notes,
        "employee_notes": row.employee_notes,
        "next_meeting_date": row.next_meeting_date,
        "recurrence": row.recurrence,
        "action_items": action_items,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def list_meetings(
    db: AsyncSession,
    *,
    company_id: str,
    employee_user_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = select(PulseWorkerMeeting).where(PulseWorkerMeeting.company_id == company_id)
    if employee_user_id:
        stmt = stmt.where(PulseWorkerMeeting.employee_user_id == employee_user_id)
    if status:
        stmt = stmt.where(PulseWorkerMeeting.status == status)
    stmt = stmt.order_by(PulseWorkerMeeting.scheduled_date.desc().nullslast())
    rows = list((await db.execute(stmt)).scalars().all())
    ids = [str(r.id) for r in rows]
    items_map = await _action_items_for_meetings(db, ids)
    name_ids = list({str(r.employee_user_id) for r in rows} | {str(r.manager_user_id) for r in rows if r.manager_user_id})
    names = await _name_map(db, name_ids)
    assignee_ids = [
        str(ai.assigned_to_user_id) for items in items_map.values() for ai in items if ai.assigned_to_user_id
    ]
    names.update(await _name_map(db, list(set(assignee_ids))))

    out: list[dict[str, Any]] = []
    for row in rows:
        actions = [
            _serialize_action_item(ai, names)
            for ai in items_map.get(str(row.id), [])
        ]
        out.append(
            _serialize_meeting(
                row,
                employee_name=names.get(str(row.employee_user_id)),
                manager_name=names.get(str(row.manager_user_id or "")),
                action_items=actions,
            ),
        )
    return out


async def list_action_items(
    db: AsyncSession,
    *,
    company_id: str,
    employee_user_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = select(PulseMeetingActionItem).where(PulseMeetingActionItem.company_id == company_id)
    if employee_user_id:
        stmt = stmt.where(PulseMeetingActionItem.employee_user_id == employee_user_id)
    if status:
        stmt = stmt.where(PulseMeetingActionItem.status == status)
    rows = list((await db.execute(stmt)).scalars().all())
    name_ids = list(
        {str(r.assigned_to_user_id) for r in rows if r.assigned_to_user_id}
        | {str(r.employee_user_id) for r in rows}
    )
    names = await _name_map(db, name_ids)
    return [_serialize_action_item(r, names) for r in rows]


async def create_meeting(
    db: AsyncSession,
    *,
    company_id: str,
    manager_user_id: Optional[str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    row = PulseWorkerMeeting(
        id=str(uuid4()),
        company_id=company_id,
        employee_user_id=payload["employee_user_id"],
        manager_user_id=manager_user_id,
        meeting_type=payload.get("meeting_type") or "one_on_one",
        scheduled_date=payload.get("scheduled_date"),
        status=payload.get("status") or "upcoming",
        agenda=payload.get("agenda"),
        wins=payload.get("wins"),
        challenges=payload.get("challenges"),
        goals=payload.get("goals"),
        manager_notes=payload.get("manager_notes"),
        employee_notes=payload.get("employee_notes"),
        next_meeting_date=payload.get("next_meeting_date"),
        recurrence=payload.get("recurrence"),
    )
    db.add(row)
    await db.flush()
    actions: list[dict[str, Any]] = []
    for item in payload.get("action_items") or []:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        ai = PulseMeetingActionItem(
            id=str(uuid4()),
            company_id=company_id,
            meeting_id=row.id,
            employee_user_id=row.employee_user_id,
            assigned_to_user_id=item.get("assigned_to_user_id"),
            title=item["title"],
            due_date=item.get("due_date"),
            status=item.get("status") or "open",
            notes=item.get("notes"),
            project_id=item.get("project_id"),
        )
        db.add(ai)
        actions.append(_serialize_action_item(ai, {}))
    await db.flush()
    names = await _name_map(db, [str(row.employee_user_id), str(manager_user_id or "")])
    return _serialize_meeting(
        row,
        employee_name=names.get(str(row.employee_user_id)),
        manager_name=names.get(str(manager_user_id or "")),
        action_items=actions,
    )


async def patch_meeting(
    db: AsyncSession,
    *,
    company_id: str,
    meeting_id: str,
    payload: dict[str, Any],
) -> Optional[dict[str, Any]]:
    row = await db.get(PulseWorkerMeeting, meeting_id)
    if not row or str(row.company_id) != str(company_id):
        return None
    for field in (
        "scheduled_date",
        "status",
        "agenda",
        "wins",
        "challenges",
        "goals",
        "manager_notes",
        "employee_notes",
        "next_meeting_date",
        "recurrence",
    ):
        if field in payload:
            setattr(row, field, payload[field])
    if payload.get("action_items") is not None:
        existing = await db.execute(
            select(PulseMeetingActionItem).where(PulseMeetingActionItem.meeting_id == meeting_id)
        )
        for old in existing.scalars().all():
            await db.delete(old)
        for item in payload["action_items"] or []:
            if not isinstance(item, dict) or not item.get("title"):
                continue
            db.add(
                PulseMeetingActionItem(
                    id=str(uuid4()),
                    company_id=company_id,
                    meeting_id=row.id,
                    employee_user_id=row.employee_user_id,
                    assigned_to_user_id=item.get("assigned_to_user_id"),
                    title=item["title"],
                    due_date=item.get("due_date"),
                    status=item.get("status") or "open",
                    notes=item.get("notes"),
                    project_id=item.get("project_id"),
                ),
            )
    await db.flush()
    items = await list_meetings(db, company_id=company_id, employee_user_id=str(row.employee_user_id))
    return next((m for m in items if m["id"] == meeting_id), None)


class MeetingsIntegrationHooks:
    """Placeholder for Outlook / Google Calendar sync."""

    calendar_providers: list[str] = []
