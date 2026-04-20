"""Task auto-generation helpers for the XP system."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.gamification_models import Task
from app.models.pulse_models import PulseWorkRequest, PulseWorkRequestPriority


async def sync_linked_task_assignee_from_work_request(
    db: AsyncSession,
    *,
    work_request: PulseWorkRequest,
) -> None:
    """Keep gamified Task.assignee in sync when a work order assignee changes (WS push for mobile)."""
    q = await db.execute(
        select(Task).where(
            Task.company_id == str(work_request.company_id),
            Task.source_type == "work_order",
            Task.source_id == str(work_request.id),
        )
    )
    t = q.scalar_one_or_none()
    if not t:
        return
    new_assignee = work_request.assigned_user_id
    if str(t.assigned_to or "") == str(new_assignee or ""):
        return
    t.assigned_to = new_assignee
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="gamification.task_assigned",
            company_id=str(work_request.company_id),
            entity_id=str(t.id),
            source_module="gamification",
            metadata={
                "task_id": str(t.id),
                "assigned_to": str(new_assignee) if new_assignee else None,
                "source_type": "work_order",
                "source_id": str(work_request.id),
            },
        )
    )


def _priority_to_int(p: Optional[PulseWorkRequestPriority]) -> int:
    if not p:
        return 1
    v = p.value if hasattr(p, "value") else str(p)
    v = str(v).strip().lower()
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(v, 1)


async def ensure_task_for_work_request(
    db: AsyncSession,
    *,
    work_request: PulseWorkRequest,
    created_by_user_id: Optional[str],
) -> Optional[Task]:
    """
    Create (or ensure existence of) a gamified Task corresponding to a Pulse work request.

    Duplicate protection is enforced by a unique DB index on (company_id, source_type, source_id).
    """
    t = Task(
        company_id=str(work_request.company_id),
        title=str(work_request.title or "Work order").strip()[:240],
        description=work_request.description,
        assigned_to=work_request.assigned_user_id,
        created_by=created_by_user_id,
        source_type="work_order",
        source_id=str(work_request.id),
        equipment_id=work_request.equipment_id,
        priority=_priority_to_int(getattr(work_request, "priority", None)),
        difficulty=1,
        status="todo",
        due_date=work_request.due_date,
        created_at=datetime.now(timezone.utc),
    )
    db.add(t)
    try:
        await db.flush()
        await event_engine.publish(
            DomainEvent(
                event_type="gamification.task_created",
                company_id=str(work_request.company_id),
                entity_id=str(t.id),
                source_module="gamification",
                metadata={
                    "task_id": str(t.id),
                    "source_type": "work_order",
                    "source_id": str(work_request.id),
                    "assigned_to": str(work_request.assigned_user_id) if work_request.assigned_user_id else None,
                },
            )
        )
        return t
    except IntegrityError:
        await db.rollback()
        # Existing task (duplicate insert) – fetch it for callers that care.
        q = await db.execute(
            select(Task).where(
                Task.company_id == str(work_request.company_id),
                Task.source_type == "work_order",
                Task.source_id == str(work_request.id),
            )
        )
        return q.scalar_one_or_none()


async def ensure_task_for_pm_due(
    db: AsyncSession,
    *,
    company_id: str,
    pm_task_id: str,
    title: str,
    description: Optional[str],
    equipment_id: Optional[str],
    due_at: Optional[datetime],
) -> Optional[Task]:
    """
    Create/ensure a task for a PM schedule becoming due.
    """
    t = Task(
        company_id=str(company_id),
        title=str(title or "Preventative maintenance").strip()[:240],
        description=description,
        assigned_to=None,
        created_by=None,
        source_type="pm",
        source_id=str(pm_task_id),
        equipment_id=equipment_id,
        priority=2,
        difficulty=1,
        status="todo",
        due_date=due_at,
        created_at=datetime.now(timezone.utc),
    )
    db.add(t)
    try:
        await db.flush()
        await event_engine.publish(
            DomainEvent(
                event_type="gamification.task_created",
                company_id=str(company_id),
                entity_id=str(t.id),
                source_module="gamification",
                metadata={
                    "task_id": str(t.id),
                    "source_type": "pm",
                    "source_id": str(pm_task_id),
                    "assigned_to": None,
                },
            )
        )
        return t
    except IntegrityError:
        await db.rollback()
        q = await db.execute(
            select(Task).where(
                Task.company_id == str(company_id),
                Task.source_type == "pm",
                Task.source_id == str(pm_task_id),
            )
        )
        return q.scalar_one_or_none()

