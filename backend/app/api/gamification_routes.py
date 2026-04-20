"""Gamified tasks + XP endpoints (tenant-scoped)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.database import get_db
from app.core.user_roles import user_has_any_role
from app.models.gamification_models import Task, TaskEvent, UserStats
from app.models.domain import User, UserRole
from app.schemas.gamification import (
    CompleteTaskResult,
    SupervisorOneOnOneIn,
    SupervisorOneOnOneOut,
    TaskFullOut,
    TaskOut,
    UserAnalyticsOut,
)
from app.services.gamification_task_full import build_task_full_payload
from app.services.xp_grant import try_grant_xp
from app.services.xp_role_policy import is_xp_excluded_admin, task_completion_role_multiplier
from app.services.xp_worker_task import compute_worker_task_completion_xp

router = APIRouter(tags=["gamification"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _open_assigned_task_rows(
    db: AsyncSession, company_id: str, user_id: str, *, limit: int, offset: int
) -> list[Task]:
    stmt = (
        select(Task)
        .where(
            Task.company_id == company_id,
            Task.assigned_to == user_id,
            Task.status.in_(("todo", "in_progress")),
        )
        .order_by(
            Task.priority.desc(),
            Task.due_date.asc().nulls_last(),
            Task.created_at.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


@router.get("/tasks/my", response_model=list[TaskOut])
async def list_my_tasks(
    db: Db,
    user: User = Depends(require_tenant_user),
    status: str | None = Query(None, description="Filter: todo | in_progress | done"),
    limit: int = Query(50, ge=1, le=200),
) -> list[TaskOut]:
    cid = str(user.company_id)
    conds = [Task.company_id == cid, Task.assigned_to == user.id]
    if status:
        conds.append(Task.status == status.strip().lower())
    rows = (
        (await db.execute(select(Task).where(*conds).order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).limit(limit)))
        .scalars()
        .all()
    )
    return [TaskOut.model_validate(r) for r in rows]


@router.get("/tasks/next", response_model=TaskOut | None)
async def get_next_task(db: Db, user: User = Depends(require_tenant_user)) -> TaskOut | None:
    cid = str(user.company_id)
    rows = await _open_assigned_task_rows(db, cid, user.id, limit=1, offset=0)
    if not rows:
        return None
    return TaskOut.model_validate(rows[0])


@router.get("/tasks/upcoming", response_model=list[TaskOut])
async def get_upcoming_tasks(
    db: Db,
    user: User = Depends(require_tenant_user),
    limit: int = Query(3, ge=0, le=10),
) -> list[TaskOut]:
    """Open tasks assigned to the worker after the current `next` task (same ordering)."""
    cid = str(user.company_id)
    if limit == 0:
        return []
    rows = await _open_assigned_task_rows(db, cid, user.id, limit=limit, offset=1)
    return [TaskOut.model_validate(r) for r in rows]


@router.get("/tasks/{task_id}/full", response_model=TaskFullOut)
async def get_task_full(
    task_id: str,
    db: Db,
    user: User = Depends(require_tenant_user),
) -> TaskFullOut:
    cid = str(user.company_id)
    task = await db.get(Task, task_id)
    if not task or str(task.company_id) != cid:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.assigned_to or str(task.assigned_to) != str(user.id):
        raise HTTPException(status_code=403, detail="Not assigned to you")
    payload = await build_task_full_payload(db, task=task, company_id=cid)
    return TaskFullOut.model_validate(payload)


@router.post("/tasks/{task_id}/complete", response_model=CompleteTaskResult)
async def complete_task(
    task_id: str,
    db: Db,
    user: User = Depends(require_tenant_user),
) -> CompleteTaskResult:
    now = datetime.now(timezone.utc)
    cid = str(user.company_id)

    task = await db.get(Task, task_id)
    if not task or str(task.company_id) != cid:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to and str(task.assigned_to) != str(user.id):
        raise HTTPException(status_code=403, detail="Not assigned to you")
    if task.status == "done":
        # Idempotent response: return current stats
        st = await db.get(UserStats, user.id)
        total = int(st.total_xp) if st else 0
        lvl = int(st.level) if st else 1
        return CompleteTaskResult(xp=int(task.xp_awarded or 0), totalXp=total, level=lvl)  # type: ignore[arg-type]

    completed_on_time = True
    if task.due_date is not None:
        completed_on_time = now <= task.due_date

    completion_time_hours = max(0.0, (now - task.created_at).total_seconds() / 3600.0)
    was_late = bool(task.due_date is not None and now > task.due_date)

    role_mult = task_completion_role_multiplier(user)
    raw_xp = compute_worker_task_completion_xp(
        task,
        completed_on_time=completed_on_time,
        completion_time_hours=completion_time_hours,
        role_multiplier=role_mult,
    )

    # Anti-gaming: cap XP from self tasks per day (max 20).
    xp = raw_xp
    if str(task.source_type) == "self" and raw_xp > 0:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        earned_today = (
            await db.execute(
                select(func.coalesce(func.sum(TaskEvent.xp_earned), 0))
                .select_from(TaskEvent)
                .join(Task, Task.id == TaskEvent.task_id)
                .where(
                    TaskEvent.company_id == cid,
                    TaskEvent.user_id == user.id,
                    TaskEvent.created_at >= day_start,
                    TaskEvent.created_at < day_end,
                    Task.source_type == "self",
                )
            )
        ).scalar_one()
        remaining = max(0, 20 - int(earned_today or 0))
        xp = min(raw_xp, remaining)

    if is_xp_excluded_admin(user):
        xp = 0

    async with db.begin_nested():
        task.status = "done"
        task.completed_at = now

        stats = await db.get(UserStats, user.id)
        if not stats:
            stats = UserStats(user_id=user.id, company_id=cid)
            db.add(stats)
            await db.flush()

        prev_completed = int(stats.tasks_completed or 0)
        new_completed = prev_completed + 1

        # Running aggregates: avoid heavy joins for analytics.
        prev_on_time_rate = float(stats.on_time_rate or 1.0)
        prev_on_time_count = prev_on_time_rate * prev_completed
        new_on_time_count = prev_on_time_count + (1.0 if completed_on_time else 0.0)
        stats.on_time_rate = float(new_on_time_count / max(1, new_completed))

        prev_avg = float(stats.avg_completion_time or 0.0)
        stats.avg_completion_time = float(((prev_avg * prev_completed) + completion_time_hours) / max(1, new_completed))

        stats.tasks_completed = int(new_completed)

    granted = 0
    if xp > 0:
        granted = await try_grant_xp(
            db,
            company_id=cid,
            user_id=str(user.id),
            track="worker",
            amount=int(xp),
            reason_code="task_completed",
            dedupe_key=f"task_completion:{task.id}",
            meta={"task_id": str(task.id), "source_type": str(task.source_type)},
        )
    task.xp_awarded = int(granted)
    db.add(
        TaskEvent(
            company_id=cid,
            task_id=task.id,
            user_id=user.id,
            xp_earned=int(granted),
            completion_time=float(completion_time_hours),
            was_late=was_late,
        )
    )

    await db.commit()
    await db.refresh(stats)
    await event_engine.publish(
        DomainEvent(
            event_type="gamification.task_completed",
            company_id=cid,
            entity_id=str(task.id),
            source_module="gamification",
            metadata={
                "task_id": str(task.id),
                "user_id": str(user.id),
                "xp": int(xp),
                "total_xp": int(stats.total_xp),
                "level": int(stats.level),
            },
        )
    )
    return CompleteTaskResult(xp=int(xp), totalXp=int(stats.total_xp), level=int(stats.level))  # type: ignore[arg-type]


@router.get("/users/{user_id}/analytics", response_model=UserAnalyticsOut)
async def user_analytics(
    user_id: str,
    db: Db,
    user: User = Depends(require_tenant_user),
) -> UserAnalyticsOut:
    cid = str(user.company_id)
    if str(user.id) != str(user_id):
        # For now: only allow self-analytics (can expand to manager later).
        raise HTTPException(status_code=403, detail="Forbidden")

    stats = await db.get(UserStats, user_id)
    if not stats or str(stats.company_id) != cid:
        # Default empty analytics
        return UserAnalyticsOut(
            totalXp=0,
            level=1,
            tasksCompleted=0,
            onTimeRate=1.0,
            avgCompletionTime=0.0,
            reviewScore=0.0,
            initiativeScore=0.0,
            xpWorker=0,
            xpLead=0,
            xpSupervisor=0,
        )

    # Quality: average review rating (0..5). (Reviews model is in the DB; keep this lightweight.)
    from app.models.gamification_models import Review

    review_avg = (
        await db.execute(
            select(func.avg(Review.rating)).where(Review.company_id == cid, Review.user_id == user_id)
        )
    ).scalar_one()
    review_score = float(review_avg or 0.0)

    # Initiative: self-created tasks completed recently, capped weight.
    self_done_30d = (
        await db.execute(
            select(func.count())
            .select_from(Task)
            .where(
                Task.company_id == cid,
                Task.assigned_to == user_id,
                Task.source_type == "self",
                Task.status == "done",
                Task.completed_at.isnot(None),
                Task.completed_at >= datetime.now(timezone.utc) - timedelta(days=30),
            )
        )
    ).scalar_one()
    initiative_score = min(1.0, float(int(self_done_30d or 0)) / 20.0)

    return UserAnalyticsOut(
        totalXp=int(stats.total_xp),
        level=int(stats.level),
        tasksCompleted=int(stats.tasks_completed),
        onTimeRate=float(stats.on_time_rate),
        avgCompletionTime=float(stats.avg_completion_time),
        reviewScore=review_score,
        initiativeScore=initiative_score,
        xpWorker=int(getattr(stats, "xp_worker", 0) or 0),
        xpLead=int(getattr(stats, "xp_lead", 0) or 0),
        xpSupervisor=int(getattr(stats, "xp_supervisor", 0) or 0),
    )


@router.post("/supervisor/one-on-one", response_model=SupervisorOneOnOneOut)
async def log_supervisor_one_on_one(
    db: Db,
    body: SupervisorOneOnOneIn,
    user: User = Depends(require_tenant_user),
) -> SupervisorOneOnOneOut:
    if not user_has_any_role(user, UserRole.supervisor):
        raise HTTPException(status_code=403, detail="Supervisor role required")
    cid = str(user.company_id)
    emp = await db.get(User, body.employee_user_id.strip())
    if not emp or str(emp.company_id) != cid:
        raise HTTPException(status_code=400, detail="Unknown employee for this organization")
    iso = datetime.now(timezone.utc).isocalendar()
    week_key = f"{iso.year}-W{iso.week:02d}"
    await event_engine.publish(
        DomainEvent(
            event_type="ops.supervisor_one_on_one",
            company_id=cid,
            entity_id=str(user.id),
            source_module="gamification",
            metadata={
                "supervisor_user_id": str(user.id),
                "employee_user_id": str(emp.id),
                "iso_week_key": week_key,
            },
        )
    )
    return SupervisorOneOnOneOut()

