"""Evaluate project automation rules after task changes."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.pulse_models import (
    PulseProjectAutomationRule,
    PulseProjectAutomationTrigger,
    PulseProjectTask,
    PulseTaskDependency,
    PulseTaskStatus,
)
from app.modules.pulse import project_service as proj_svc
from app.modules.pulse.task_dependencies import task_blocking_state


def _norm_status(v: Any) -> str:
    if v is None:
        return ""
    if hasattr(v, "value"):
        return str(v.value)
    return str(v).lower().replace(" ", "_")


def _match_condition(
    condition: dict[str, Any],
    task: PulseProjectTask,
    old_status: Optional[PulseTaskStatus],
    new_status: PulseTaskStatus,
) -> bool:
    if not condition:
        return True
    want = condition.get("status")
    if want is not None and _norm_status(want) != _norm_status(new_status):
        return False
    from_status = condition.get("from_status")
    if from_status is not None and (old_status is None or _norm_status(from_status) != _norm_status(old_status)):
        return False
    return True


def _trigger_applies(
    trigger: PulseProjectAutomationTrigger,
    task: PulseProjectTask,
    old_status: Optional[PulseTaskStatus],
    new_status: PulseTaskStatus,
    overdue_now: bool,
) -> bool:
    if trigger == PulseProjectAutomationTrigger.task_completed:
        return old_status != PulseTaskStatus.complete and new_status == PulseTaskStatus.complete
    if trigger == PulseProjectAutomationTrigger.task_status_changed:
        return old_status is not None and old_status != new_status
    if trigger == PulseProjectAutomationTrigger.task_overdue:
        return overdue_now
    return False


async def _resolve_target_task(
    db: AsyncSession,
    project_id: str,
    source: PulseProjectTask,
    action: dict[str, Any],
) -> PulseProjectTask | None:
    raw_target = action.get("target_task_id") or action.get("task_id")
    if raw_target:
        t = await db.get(PulseProjectTask, str(raw_target))
        if t and str(t.project_id) == project_id:
            return t
        return None
    if action.get("target") == "next_task":
        q = await db.execute(
            select(PulseProjectTask)
            .join(PulseTaskDependency, PulseTaskDependency.task_id == PulseProjectTask.id)
            .where(
                PulseTaskDependency.depends_on_task_id == source.id,
                PulseProjectTask.status != PulseTaskStatus.complete,
                PulseProjectTask.project_id == project_id,
            )
            .order_by(PulseProjectTask.due_date.asc(), PulseProjectTask.created_at)
            .limit(1)
        )
        return q.scalar_one_or_none()
    return None


async def _execute_action(
    db: AsyncSession,
    company_id: str,
    project_id: str,
    source: PulseProjectTask,
    action: dict[str, Any],
) -> None:
    atype = action.get("type")
    if atype == "update_task":
        target = await _resolve_target_task(db, project_id, source, action)
        if not target:
            return
        fields = action.get("fields") or {}
        if "status" in fields and fields["status"] is not None:
            new_st = proj_svc.parse_task_status(str(fields["status"]))
            if new_st == PulseTaskStatus.complete:
                blocked, _ = await task_blocking_state(db, target)
                if blocked:
                    return
            target.status = new_st
        if "priority" in fields and fields["priority"] is not None:
            target.priority = proj_svc.parse_task_priority(str(fields["priority"]))
        if "title" in fields and fields["title"] is not None:
            target.title = str(fields["title"]).strip()
        await db.flush()
        await proj_svc.ensure_calendar_shift_for_task(db, company_id, target)
        return

    if atype == "auto_assign":
        target = await _resolve_target_task(db, project_id, source, action)
        if not target:
            return
        uid = action.get("user_id")
        if not uid:
            return
        if not await proj_svc.user_in_company(db, company_id, str(uid)):
            return
        target.assigned_user_id = str(uid)
        await db.flush()
        await proj_svc.ensure_calendar_shift_for_task(db, company_id, target)
        return

    if atype == "send_notification":
        await event_engine.publish(
            DomainEvent(
                event_type="pulse.project_task.automation_notification",
                company_id=company_id,
                entity_id=str(source.id),
                source_module="pulse.projects",
                metadata={
                    "project_id": project_id,
                    "task_id": str(source.id),
                    "title": action.get("title") or "Project automation",
                    "message": action.get("message") or action.get("body") or "",
                    "user_id": action.get("user_id"),
                },
            )
        )


async def run_rules_for_task_change(
    db: AsyncSession,
    company_id: str,
    task: PulseProjectTask,
    old_status: Optional[PulseTaskStatus],
    old_due_date: Optional[date],
) -> None:
    """Run active automation rules for this task's project (single pass, ordered by created_at)."""
    today = datetime.now(timezone.utc).date()
    new_status = task.status
    overdue_now = bool(
        task.due_date and task.due_date < today and task.status != PulseTaskStatus.complete
    )

    rq = await db.execute(
        select(PulseProjectAutomationRule)
        .where(
            PulseProjectAutomationRule.project_id == task.project_id,
            PulseProjectAutomationRule.is_active.is_(True),
        )
        .order_by(PulseProjectAutomationRule.created_at)
    )
    rules = list(rq.scalars().all())

    for rule in rules:
        trig = rule.trigger_type
        if hasattr(trig, "value"):
            trig_enum = trig  # type: ignore[assignment]
        else:
            try:
                trig_enum = PulseProjectAutomationTrigger(str(trig))
            except ValueError:
                continue

        if not _trigger_applies(trig_enum, task, old_status, new_status, overdue_now):
            continue
        cond = rule.condition_json if isinstance(rule.condition_json, dict) else {}
        if not _match_condition(cond, task, old_status, new_status):
            continue
        action = rule.action_json if isinstance(rule.action_json, dict) else {}
        if not action.get("type"):
            continue
        await _execute_action(db, company_id, str(task.project_id), task, action)
