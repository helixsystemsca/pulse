"""Task dependency graph: cycles, blocking prerequisites."""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseProjectTask, PulseTaskDependency, PulseTaskStatus


async def load_adjacency_for_project(db: AsyncSession, project_id: str) -> dict[str, list[str]]:
    """Edge prerequisite -> dependent (P blocks T): for each row (task_id=T, depends_on=P), P -> T."""
    q = await db.execute(
        select(PulseTaskDependency.task_id, PulseTaskDependency.depends_on_task_id).where(
            PulseTaskDependency.task_id.in_(
                select(PulseProjectTask.id).where(PulseProjectTask.project_id == project_id)
            )
        )
    )
    adj: dict[str, list[str]] = defaultdict(list)
    for tid, dep_id in q.all():
        adj[str(dep_id)].append(str(tid))
    return adj


async def would_create_cycle(
    db: AsyncSession,
    project_id: str,
    task_id: str,
    depends_on_task_id: str,
) -> bool:
    """Adding 'task_id depends on depends_on_task_id' creates a cycle iff task_id can reach depends_on_task_id."""
    if task_id == depends_on_task_id:
        return True
    adj = await load_adjacency_for_project(db, project_id)
    target = depends_on_task_id
    start = task_id
    queue: deque[str] = deque([start])
    seen = {start}
    while queue:
        u = queue.popleft()
        for v in adj.get(u, []):
            if v == target:
                return True
            if v not in seen:
                seen.add(v)
                queue.append(v)
    return False


async def fetch_prerequisite_ids_for_tasks(db: AsyncSession, task_ids: list[str]) -> dict[str, list[str]]:
    if not task_ids:
        return {}
    q = await db.execute(
        select(PulseTaskDependency.task_id, PulseTaskDependency.depends_on_task_id).where(
            PulseTaskDependency.task_id.in_(task_ids)
        )
    )
    out: dict[str, list[str]] = defaultdict(list)
    for tid, dep_id in q.all():
        out[str(tid)].append(str(dep_id))
    return {k: list(v) for k, v in out.items()}


def compute_blocking_for_tasks(
    tasks_by_id: dict[str, PulseProjectTask],
    prereq_map: dict[str, list[str]],
) -> dict[str, tuple[bool, list[PulseProjectTask]]]:
    """For each task id, (is_blocked, incomplete prerequisite ORM rows)."""
    result: dict[str, tuple[bool, list[PulseProjectTask]]] = {}
    for tid in tasks_by_id:
        blocking: list[PulseProjectTask] = []
        for prereq_id in prereq_map.get(tid, []):
            p = tasks_by_id.get(prereq_id)
            if p is not None and p.status != PulseTaskStatus.complete:
                blocking.append(p)
        result[tid] = (len(blocking) > 0, blocking)
    return result


async def task_blocking_state(
    db: AsyncSession, t: PulseProjectTask
) -> tuple[bool, list[PulseProjectTask]]:
    pm = await fetch_prerequisite_ids_for_tasks(db, [str(t.id)])
    ids = pm.get(str(t.id), [])
    if not ids:
        return False, []
    q = await db.execute(select(PulseProjectTask).where(PulseProjectTask.id.in_(ids)))
    pres = list(q.scalars().all())
    inc = [p for p in pres if p.status != PulseTaskStatus.complete]
    return len(inc) > 0, inc


async def task_to_out_enriched(db: AsyncSession, t: PulseProjectTask) -> Any:
    from app.schemas.projects import TaskBlockingMini, task_orm_to_out

    is_bl, blocking = await task_blocking_state(db, t)
    pm = await fetch_prerequisite_ids_for_tasks(db, [str(t.id)])
    dep_ids = pm.get(str(t.id), [])
    mini = [
        TaskBlockingMini(
            id=str(b.id),
            title=b.title,
            status=b.status.value if hasattr(b.status, "value") else str(b.status),
        )
        for b in blocking
    ]
    return task_orm_to_out(t, is_blocked=is_bl, blocking_tasks=mini, depends_on_task_ids=dep_ids)
