"""Supervisor operations — accountability, missed proximity, task health aggregates."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_manager_or_above, require_tenant_user
from app.core.database import get_db
from app.models.domain import User
from app.models.pulse_models import PulseProject, PulseProjectTask, PulseProximityEventLog
from app.modules.pulse.accountability_service import (
    equipment_label_for_tag,
    evaluate_missed_proximity_events,
    run_task_health_escalations,
)
from app.modules.pulse.ready_proximity import task_priority_str
from app.modules.pulse.task_dependencies import compute_blocking_for_tasks, fetch_prerequisite_ids_for_tasks
from app.modules.pulse.performance_service import build_operations_insights, persist_performance_snapshots
from app.schemas.operations import (
    LocationBottleneckInsight,
    MissedProximityEventOut,
    OperationsAccountabilityOut,
    OperationsInsightsOut,
    OperationsInsightsSummary,
    ProjectBottleneckInsight,
    UserPerformanceInsight,
)
from app.schemas.projects import TaskHealthItem

router = APIRouter(tags=["operations"])


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _merge_at_risk(
    overdue: list[TaskHealthItem],
    stale: list[TaskHealthItem],
    blocked: list[TaskHealthItem],
) -> list[TaskHealthItem]:
    by_id: dict[str, TaskHealthItem] = {}
    for it in overdue + stale + blocked:
        cur = by_id.get(it.id)
        if cur is None:
            by_id[it.id] = it.model_copy()
        else:
            by_id[it.id] = cur.model_copy(
                update={
                    "is_overdue": cur.is_overdue or it.is_overdue,
                    "is_stale": cur.is_stale or it.is_stale,
                    "is_blocked": cur.is_blocked or it.is_blocked,
                }
            )
    return list(by_id.values())


async def _company_task_buckets(
    db: AsyncSession, cid: str, proj_names: dict[str, str]
) -> tuple[list[TaskHealthItem], list[TaskHealthItem], list[TaskHealthItem]]:
    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.company_id == cid))
    task_orms = list(tq.scalars().all())
    ids = [str(x.id) for x in task_orms]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    needed: set[str] = set(ids)
    for i in ids:
        needed.update(prereq_map.get(i, []))
    if needed != set(ids):
        tq2 = await db.execute(select(PulseProjectTask).where(PulseProjectTask.id.in_(needed)))
        by_id = {str(t.id): t for t in task_orms}
        for t in tq2.scalars().all():
            by_id.setdefault(str(t.id), t)
    else:
        by_id = {str(t.id): t for t in task_orms}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    overdue: list[TaskHealthItem] = []
    stale: list[TaskHealthItem] = []
    blocked: list[TaskHealthItem] = []
    for t in task_orms:
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        if st == "complete":
            continue
        is_bl = block_map[str(t.id)][0]
        is_od = bool(t.due_date and t.due_date < today)
        is_st = bool((now - t.updated_at).total_seconds() > 86400)
        pid = str(t.project_id)
        item = TaskHealthItem(
            id=str(t.id),
            project_id=pid,
            project_name=proj_names.get(pid, ""),
            title=t.title,
            priority=task_priority_str(t),
            status=st,
            due_date=t.due_date,
            assigned_user_id=str(t.assigned_user_id) if t.assigned_user_id else None,
            is_blocked=is_bl,
            is_overdue=is_od,
            is_stale=is_st,
        )
        if is_od:
            overdue.append(item)
        if is_st:
            stale.append(item)
        if is_bl:
            blocked.append(item)
    return overdue, stale, blocked


@router.get("/operations/accountability", response_model=OperationsAccountabilityOut)
async def operations_accountability(
    db: Db,
    cid: CompanyId,
    _role: Annotated[User, Depends(require_manager_or_above)],
) -> OperationsAccountabilityOut:
    await evaluate_missed_proximity_events(db, cid)
    await run_task_health_escalations(db, cid)

    pq = await db.execute(select(PulseProject).where(PulseProject.company_id == cid))
    projects = list(pq.scalars().all())
    proj_names = {str(p.id): p.name for p in projects}

    overdue, stale, blocked = await _company_task_buckets(db, cid, proj_names)
    at_risk = _merge_at_risk(overdue, stale, blocked)

    lq = await db.execute(
        select(PulseProximityEventLog)
        .where(
            PulseProximityEventLog.company_id == cid,
            PulseProximityEventLog.is_missed.is_(True),
        )
        .order_by(PulseProximityEventLog.missed_at.desc().nulls_last(), PulseProximityEventLog.detected_at.desc())
        .limit(200)
    )
    missed_rows = list(lq.scalars().all())
    missed_out: list[MissedProximityEventOut] = []
    for row in missed_rows:
        u = await db.get(User, row.user_id)
        tp = row.tasks_present if isinstance(row.tasks_present, list) else []
        titles: list[str] = []
        for raw in tp[:30]:
            tt = await db.get(PulseProjectTask, str(raw))
            if tt:
                titles.append(tt.title)
        eq = await equipment_label_for_tag(db, cid, row.location_tag_id)
        missed_out.append(
            MissedProximityEventOut(
                id=str(row.id),
                user_id=str(row.user_id),
                user_email=u.email if u else None,
                user_full_name=u.full_name if u else None,
                location_tag_id=row.location_tag_id,
                equipment_label=eq,
                tasks_present=[str(x) for x in tp],
                task_titles=titles,
                detected_at=row.detected_at,
                is_missed=row.is_missed,
                missed_at=row.missed_at,
            )
        )

    await db.commit()
    return OperationsAccountabilityOut(
        missed_proximity=missed_out,
        overdue_tasks=overdue,
        stale_tasks=stale,
        blocked_tasks=blocked,
        at_risk_tasks=at_risk,
    )


@router.get("/operations/insights", response_model=OperationsInsightsOut)
async def operations_insights(
    db: Db,
    cid: CompanyId,
    _role: Annotated[User, Depends(require_manager_or_above)],
    time_window: str = Query("24h", description="24h, 7d, or 30d"),
) -> OperationsInsightsOut:
    await evaluate_missed_proximity_events(db, cid)
    await run_task_health_escalations(db, cid)

    raw = await build_operations_insights(db, cid, time_window)
    await persist_performance_snapshots(db, cid, raw["time_window"], raw["user_performance"])

    up = [
        UserPerformanceInsight.model_validate({k: v for k, v in r.items() if k != "email"})
        for r in raw["user_performance"]
    ]
    loc = [LocationBottleneckInsight.model_validate(x) for x in raw["location_bottlenecks"]]
    proj = [ProjectBottleneckInsight.model_validate(x) for x in raw["project_bottlenecks"]]
    summary = OperationsInsightsSummary.model_validate(raw["summary"])

    await db.commit()
    return OperationsInsightsOut(
        time_window=raw["time_window"],
        summary=summary,
        user_performance=up,
        location_bottlenecks=loc,
        project_bottlenecks=proj,
    )
