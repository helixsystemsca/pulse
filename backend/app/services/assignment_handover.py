"""Routine assignment handover notes — permissions and metadata."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schedule_department import primary_department_slug_from_hr_for_company
from app.models.domain import User, Zone
from app.models.pulse_models import (
    PulseRoutine,
    PulseRoutineAssignment,
    PulseRoutineAssignmentExtra,
    PulseRoutineAssignmentHandover,
    PulseRoutineItemAssignment,
    PulseWorkerHR,
)
from app.services.routine_shift_band import resolve_shift_band_for_shift_id

HANDOVER_NOTE_TYPES = frozenset(
    {
        "informational",
        "follow_up_required",
        "incomplete",
        "maintenance_concern",
        "safety_concern",
    }
)

OPEN_HANDOVER_NOTE_TYPES = frozenset(
    {
        "follow_up_required",
        "incomplete",
        "maintenance_concern",
        "safety_concern",
    }
)


def user_is_supervisor_for_handovers(user: User) -> bool:
    from app.core.user_roles import user_has_any_role
    from app.models.domain import UserRole

    return user_has_any_role(
        user,
        UserRole.system_admin,
        UserRole.company_admin,
        UserRole.manager,
        UserRole.supervisor,
    )


async def user_involved_in_assignment(
    db: AsyncSession,
    cid: str,
    assignment: PulseRoutineAssignment,
    uid: str,
) -> bool:
    if str(assignment.primary_user_id) == uid:
        return True
    aid = str(assignment.id)
    ia = await db.execute(
        select(PulseRoutineItemAssignment.id).where(
            PulseRoutineItemAssignment.company_id == cid,
            PulseRoutineItemAssignment.routine_assignment_id == aid,
            PulseRoutineItemAssignment.assigned_to_user_id == uid,
        ).limit(1)
    )
    if ia.scalar_one_or_none():
        return True
    ex = await db.execute(
        select(PulseRoutineAssignmentExtra.id).where(
            PulseRoutineAssignmentExtra.company_id == cid,
            PulseRoutineAssignmentExtra.routine_assignment_id == aid,
            PulseRoutineAssignmentExtra.assigned_to_user_id == uid,
        ).limit(1)
    )
    return ex.scalar_one_or_none() is not None


async def resolve_handover_metadata(
    db: AsyncSession,
    cid: str,
    assignment: PulseRoutineAssignment,
    *,
    employee_name_override: Optional[str] = None,
) -> dict[str, Optional[str]]:
    routine = await db.get(PulseRoutine, assignment.routine_id)
    operational_area: Optional[str] = None
    if routine and routine.zone_id:
        zone = await db.get(Zone, routine.zone_id)
        if zone and str(zone.company_id) == cid:
            operational_area = (zone.name or "").strip() or None
    if not operational_area and routine:
        operational_area = (routine.name or "").strip() or None

    shift_label: Optional[str] = None
    if assignment.shift_id:
        band = await resolve_shift_band_for_shift_id(db, cid, str(assignment.shift_id))
        if band:
            shift_label = str(band)

    employee_user_id = str(assignment.primary_user_id)
    employee_name = employee_name_override
    department_slug: Optional[str] = None
    hr = await db.get(PulseWorkerHR, employee_user_id)
    if hr and str(hr.company_id) == cid:
        department_slug = await primary_department_slug_from_hr_for_company(db, cid, hr)
        if not employee_name:
            employee_name = (hr.job_title or "").strip() or None
    if not employee_name:
        author = await db.get(User, employee_user_id)
        if author:
            employee_name = (author.full_name or author.email or "").strip() or None

    assignment_date: Optional[date] = assignment.date
    return {
        "employee_user_id": employee_user_id,
        "employee_name": employee_name,
        "department_slug": department_slug,
        "operational_area": operational_area,
        "shift_id": str(assignment.shift_id) if assignment.shift_id else None,
        "shift_label": shift_label,
        "assignment_date": assignment_date,
    }


def handover_defaults_resolved(note_type: str) -> bool:
    return note_type == "informational"


def handover_out_dict(
    row: PulseRoutineAssignmentHandover,
    *,
    author_display: Optional[str] = None,
    resolved_by_display: Optional[str] = None,
    edited_by_display: Optional[str] = None,
) -> dict:
    return {
        "id": str(row.id),
        "routine_assignment_id": str(row.routine_assignment_id),
        "author_user_id": str(row.author_user_id),
        "author_display": author_display,
        "employee_user_id": str(row.employee_user_id) if row.employee_user_id else None,
        "employee_name": row.employee_name,
        "department_slug": row.department_slug,
        "operational_area": row.operational_area,
        "shift_id": str(row.shift_id) if row.shift_id else None,
        "shift_label": row.shift_label,
        "assignment_date": str(row.assignment_date) if row.assignment_date else None,
        "note_type": row.note_type,
        "content": row.content,
        "is_resolved": bool(row.is_resolved),
        "resolved_at": row.resolved_at,
        "resolved_by_user_id": str(row.resolved_by_user_id) if row.resolved_by_user_id else None,
        "resolved_by_display": resolved_by_display,
        "last_edited_by_user_id": str(row.last_edited_by_user_id) if row.last_edited_by_user_id else None,
        "edited_by_display": edited_by_display,
        "attachment_path": row.attachment_path,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def display_name_for_user(db: AsyncSession, user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    u = await db.get(User, user_id)
    if not u:
        return None
    return (u.full_name or u.email or "").strip() or None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
