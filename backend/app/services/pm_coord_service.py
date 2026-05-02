"""Dependency graph helpers for `pm_coord_task_dependencies`."""

from __future__ import annotations

from collections import defaultdict, deque

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pm_coord_models import PmCoordTaskDependency


async def load_adjacency_pm_coord(db: AsyncSession, project_id: str) -> dict[str, list[str]]:
    """Edges prerequisite -> dependent (P blocks T)."""
    from app.models.pm_coord_models import PmCoordTask

    q = await db.execute(
        select(PmCoordTaskDependency.task_id, PmCoordTaskDependency.depends_on_task_id).where(
            PmCoordTaskDependency.task_id.in_(
                select(PmCoordTask.id).where(PmCoordTask.project_id == project_id)
            )
        )
    )
    adj: dict[str, list[str]] = defaultdict(list)
    for tid, dep_id in q.all():
        adj[str(dep_id)].append(str(tid))
    return adj


async def would_create_cycle_pm_coord(
    db: AsyncSession,
    project_id: str,
    task_id: str,
    depends_on_task_id: str,
) -> bool:
    """Adding task_id → depends on depends_on_task_id creates a cycle iff task_id can reach depends_on_task_id."""
    if task_id == depends_on_task_id:
        return True
    adj = await load_adjacency_pm_coord(db, project_id)
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


async def prerequisite_ids_for_tasks(db: AsyncSession, task_ids: list[str]) -> dict[str, list[str]]:
    if not task_ids:
        return {}
    q = await db.execute(
        select(PmCoordTaskDependency.task_id, PmCoordTaskDependency.depends_on_task_id).where(
            PmCoordTaskDependency.task_id.in_(task_ids)
        )
    )
    out: dict[str, list[str]] = defaultdict(list)
    for tid, dep_id in q.all():
        out[str(tid)].append(str(dep_id))
    return {k: list(v) for k, v in out.items()}
