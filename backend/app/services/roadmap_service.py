"""Strategic roadmap CRUD and stats."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pulse_models import PulseProject, PulseProjectTask
from app.models.roadmap_models import RoadmapMilestone, RoadmapProject


def _milestone_dict(row: RoadmapMilestone) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "roadmap_project_id": str(row.roadmap_project_id) if row.roadmap_project_id else None,
        "title": row.title,
        "milestone_date": row.milestone_date,
        "completed": bool(row.completed),
        "sort_order": row.sort_order,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _project_dict(row: RoadmapProject, *, include_milestones: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "title": row.title,
        "description": row.description,
        "category": row.category,
        "owner": row.owner,
        "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
        "color": row.color,
        "start_date": row.start_date,
        "end_date": row.end_date,
        "progress": int(row.progress or 0),
        "priority": row.priority,
        "status": row.status,
        "budget": float(row.budget) if row.budget is not None else None,
        "tags": list(row.tags or []),
        "dependencies": [str(x) for x in (row.dependencies or [])],
        "notes": row.notes,
        "attachments": list(row.attachments or []),
        "sort_order": row.sort_order,
        "archived": bool(row.archived),
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    if include_milestones:
        out["milestones"] = [_milestone_dict(m) for m in row.milestones]
    return out


def _list_dict(row: RoadmapProject) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "title": row.title,
        "category": row.category,
        "owner": row.owner,
        "color": row.color,
        "start_date": row.start_date,
        "end_date": row.end_date,
        "progress": int(row.progress or 0),
        "priority": row.priority,
        "status": row.status,
        "sort_order": row.sort_order,
        "archived": bool(row.archived),
        "dependencies": [str(x) for x in (row.dependencies or [])],
    }


async def _next_sort_order(db: AsyncSession, company_id: str) -> int:
    r = await db.execute(
        select(func.coalesce(func.max(RoadmapProject.sort_order), -1)).where(RoadmapProject.company_id == company_id)
    )
    return int(r.scalar_one()) + 1


async def list_projects(
    db: AsyncSession,
    company_id: str,
    *,
    archived: Optional[bool] = False,
    q: Optional[str] = None,
    category: Optional[str] = None,
    owner: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    tag: Optional[str] = None,
) -> list[RoadmapProject]:
    stmt = select(RoadmapProject).where(RoadmapProject.company_id == company_id)
    if archived is not None:
        stmt = stmt.where(RoadmapProject.archived == archived)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(RoadmapProject.title.ilike(like), RoadmapProject.description.ilike(like)))
    if category:
        stmt = stmt.where(RoadmapProject.category == category)
    if owner:
        stmt = stmt.where(RoadmapProject.owner.ilike(f"%{owner.strip()}%"))
    if status:
        stmt = stmt.where(RoadmapProject.status == status)
    if priority:
        stmt = stmt.where(RoadmapProject.priority == priority)
    if tag:
        stmt = stmt.where(RoadmapProject.tags.contains([tag]))
    stmt = stmt.order_by(RoadmapProject.sort_order, RoadmapProject.start_date, RoadmapProject.title)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_project(db: AsyncSession, company_id: str, project_id: str) -> RoadmapProject | None:
    stmt = (
        select(RoadmapProject)
        .where(RoadmapProject.company_id == company_id, RoadmapProject.id == project_id)
        .options(selectinload(RoadmapProject.milestones))
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_project(
    db: AsyncSession,
    company_id: str,
    actor_user_id: str,
    *,
    data: dict[str, Any],
) -> RoadmapProject:
    row = RoadmapProject(
        company_id=company_id,
        title=data["title"],
        description=data.get("description"),
        category=data.get("category") or "projects",
        owner=data.get("owner"),
        owner_user_id=data.get("owner_user_id"),
        color=data.get("color"),
        start_date=data["start_date"],
        end_date=data["end_date"],
        progress=int(data.get("progress") or 0),
        priority=data.get("priority") or "medium",
        status=data.get("status") or "planned",
        budget=data.get("budget"),
        tags=list(data.get("tags") or []),
        dependencies=list(data.get("dependencies") or []),
        notes=data.get("notes"),
        attachments=[a if isinstance(a, dict) else a.model_dump() for a in (data.get("attachments") or [])],
        sort_order=data.get("sort_order") if data.get("sort_order") is not None else await _next_sort_order(db, company_id),
        created_by_user_id=actor_user_id,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row, attribute_names=["milestones"])
    return row


async def patch_project(
    db: AsyncSession,
    company_id: str,
    project_id: str,
    *,
    data: dict[str, Any],
) -> RoadmapProject:
    row = await get_project(db, company_id, project_id)
    if not row:
        raise LookupError("not found")
    if "title" in data and data["title"] is not None:
        row.title = data["title"]
    if "description" in data:
        row.description = data["description"]
    if "category" in data and data["category"] is not None:
        row.category = data["category"]
    if "owner" in data:
        row.owner = data["owner"]
    if "owner_user_id" in data:
        row.owner_user_id = data["owner_user_id"]
    if "color" in data:
        row.color = data["color"]
    if "start_date" in data and data["start_date"] is not None:
        row.start_date = data["start_date"]
    if "end_date" in data and data["end_date"] is not None:
        row.end_date = data["end_date"]
    if row.end_date < row.start_date:
        raise ValueError("end_date must be on or after start_date")
    if "progress" in data and data["progress"] is not None:
        row.progress = int(data["progress"])
    if "priority" in data and data["priority"] is not None:
        row.priority = data["priority"]
    if "status" in data and data["status"] is not None:
        row.status = data["status"]
    if "budget" in data:
        row.budget = data["budget"]
    if "tags" in data and data["tags"] is not None:
        row.tags = list(data["tags"])
    if "dependencies" in data and data["dependencies"] is not None:
        row.dependencies = list(data["dependencies"])
    if "notes" in data:
        row.notes = data["notes"]
    if "attachments" in data and data["attachments"] is not None:
        row.attachments = [a if isinstance(a, dict) else a.model_dump() for a in data["attachments"]]
    if "sort_order" in data and data["sort_order"] is not None:
        row.sort_order = int(data["sort_order"])
    if "archived" in data and data["archived"] is not None:
        row.archived = bool(data["archived"])
    await db.flush()
    return row


async def delete_project(db: AsyncSession, company_id: str, project_id: str) -> None:
    row = await get_project(db, company_id, project_id)
    if not row:
        raise LookupError("not found")
    await db.delete(row)


async def list_milestones(
    db: AsyncSession,
    company_id: str,
    *,
    year: Optional[int] = None,
    include_completed: bool = True,
) -> list[RoadmapMilestone]:
    stmt = select(RoadmapMilestone).where(RoadmapMilestone.company_id == company_id)
    if year is not None:
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        stmt = stmt.where(RoadmapMilestone.milestone_date >= start, RoadmapMilestone.milestone_date <= end)
    if not include_completed:
        stmt = stmt.where(RoadmapMilestone.completed.is_(False))
    stmt = stmt.order_by(RoadmapMilestone.milestone_date, RoadmapMilestone.sort_order)
    return list((await db.execute(stmt)).scalars().all())


async def create_milestone(db: AsyncSession, company_id: str, *, data: dict[str, Any]) -> RoadmapMilestone:
    if data.get("roadmap_project_id"):
        proj = await get_project(db, company_id, str(data["roadmap_project_id"]))
        if not proj:
            raise ValueError("project not found")
    row = RoadmapMilestone(
        company_id=company_id,
        roadmap_project_id=data.get("roadmap_project_id"),
        title=data["title"],
        milestone_date=data["milestone_date"],
        completed=bool(data.get("completed")),
        sort_order=int(data.get("sort_order") or 0),
    )
    db.add(row)
    await db.flush()
    return row


async def patch_milestone(db: AsyncSession, company_id: str, milestone_id: str, *, data: dict[str, Any]) -> RoadmapMilestone:
    row = (
        await db.execute(
            select(RoadmapMilestone).where(
                RoadmapMilestone.company_id == company_id,
                RoadmapMilestone.id == milestone_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise LookupError("not found")
    if "title" in data and data["title"] is not None:
        row.title = data["title"]
    if "milestone_date" in data and data["milestone_date"] is not None:
        row.milestone_date = data["milestone_date"]
    if "roadmap_project_id" in data:
        row.roadmap_project_id = data["roadmap_project_id"]
    if "completed" in data and data["completed"] is not None:
        row.completed = bool(data["completed"])
    if "sort_order" in data and data["sort_order"] is not None:
        row.sort_order = int(data["sort_order"])
    await db.flush()
    return row


async def delete_milestone(db: AsyncSession, company_id: str, milestone_id: str) -> None:
    row = (
        await db.execute(
            select(RoadmapMilestone).where(
                RoadmapMilestone.company_id == company_id,
                RoadmapMilestone.id == milestone_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise LookupError("not found")
    await db.delete(row)


async def list_task_milestones_for_year(
    db: AsyncSession,
    company_id: str,
    *,
    year: int,
) -> list[dict[str, Any]]:
    """Task due dates as roadmap milestone markers (sourced from pulse_projects)."""
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    q = await db.execute(
        select(PulseProjectTask, PulseProject.name)
        .join(PulseProject, PulseProject.id == PulseProjectTask.project_id)
        .where(
            PulseProject.company_id == company_id,
            PulseProjectTask.due_date.isnot(None),
            PulseProjectTask.due_date >= start,
            PulseProjectTask.due_date <= end,
        )
        .order_by(PulseProjectTask.due_date, PulseProjectTask.title)
    )
    out: list[dict[str, Any]] = []
    for task, _proj_name in q.all():
        due = task.due_date
        if not due:
            continue
        st = task.status.value if hasattr(task.status, "value") else str(task.status)
        out.append(
            {
                "id": str(task.id),
                "project_id": str(task.project_id),
                "title": str(task.title),
                "milestone_date": due,
                "completed": st == "complete",
            }
        )
    return out


async def compute_stats(db: AsyncSession, company_id: str) -> dict[str, int]:
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=30)
    projects = await list_projects(db, company_id, archived=False)
    total = len(projects)
    completed = sum(1 for p in projects if p.status == "completed")
    in_progress = sum(1 for p in projects if p.status == "in_progress")
    behind = sum(
        1
        for p in projects
        if p.status in ("planned", "in_progress") and p.end_date < today and p.progress < 100
    )
    ms = await list_task_milestones_for_year(db, company_id, year=today.year)
    upcoming = sum(
        1
        for m in ms
        if not m.get("completed") and today <= m["milestone_date"] <= horizon
    )
    return {
        "total": total,
        "completed": completed,
        "in_progress": in_progress,
        "behind": behind,
        "upcoming_milestones": upcoming,
    }
