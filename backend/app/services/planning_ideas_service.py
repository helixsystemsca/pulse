"""Planning ideas CRUD and convert-to-project workflow."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schedule_department import (
    DEFAULT_SCHEDULE_DEPARTMENT_SLUG,
    normalize_schedule_department_slug,
    primary_department_slug_from_hr,
)
from app.models.domain import User
from app.models.pulse_models import (
    PlanningIdea,
    PulseCategory,
    PulseProject,
    PulseProjectActivity,
    PulseProjectActivityType,
    PulseProjectTask,
    PulseProjectTemplate,
    PulseProjectTemplateTask,
    PulseWorkerHR,
)
from app.modules.pulse import project_service as proj_svc
from app.services.notifications import seed_default_notification_rules


def _idea_to_dict(row: PlanningIdea) -> dict:
    cost = row.estimated_cost
    if cost is not None and not isinstance(cost, Decimal):
        cost = Decimal(str(cost))
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "title": row.title,
        "description": row.description,
        "location": row.location,
        "category": row.category,
        "estimated_cost": cost,
        "priority": row.priority,
        "status": row.status,
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "linked_project_id": str(row.linked_project_id) if row.linked_project_id else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "converted_at": row.converted_at,
    }


async def list_ideas(
    db: AsyncSession,
    company_id: str,
    *,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> list[PlanningIdea]:
    stmt = select(PlanningIdea).where(PlanningIdea.company_id == company_id)
    if status:
        stmt = stmt.where(PlanningIdea.status == status.strip())
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            PlanningIdea.title.ilike(needle)
            | PlanningIdea.description.ilike(needle)
            | PlanningIdea.location.ilike(needle)
            | PlanningIdea.category.ilike(needle)
        )
    stmt = stmt.order_by(PlanningIdea.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def get_idea(db: AsyncSession, company_id: str, idea_id: str) -> PlanningIdea | None:
    row = await db.get(PlanningIdea, idea_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


async def create_idea(
    db: AsyncSession,
    company_id: str,
    actor_id: str,
    *,
    title: str,
    description: Optional[str],
    location: Optional[str],
    category: Optional[str],
    estimated_cost: Optional[Decimal],
    priority: str,
    status: str,
) -> PlanningIdea:
    row = PlanningIdea(
        company_id=company_id,
        title=title.strip(),
        description=(description or "").strip() or None,
        location=(location or "").strip() or None,
        category=(category or "").strip() or None,
        estimated_cost=estimated_cost,
        priority=priority,
        status=status,
        created_by_user_id=actor_id,
    )
    db.add(row)
    await db.flush()
    return row


async def patch_idea(
    db: AsyncSession,
    row: PlanningIdea,
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    estimated_cost: Optional[Decimal] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    clear_estimated_cost: bool = False,
) -> PlanningIdea:
    if row.status == "converted" and status and status != "converted":
        raise ValueError("converted ideas cannot change status")
    if title is not None:
        row.title = title.strip()
    if description is not None:
        row.description = description.strip() or None
    if location is not None:
        row.location = location.strip() or None
    if category is not None:
        row.category = category.strip() or None
    if clear_estimated_cost:
        row.estimated_cost = None
    elif estimated_cost is not None:
        row.estimated_cost = estimated_cost
    if priority is not None:
        row.priority = priority
    if status is not None:
        row.status = status
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return row


async def delete_idea(db: AsyncSession, row: PlanningIdea) -> None:
    await db.delete(row)


def _build_project_description(idea: PlanningIdea) -> str | None:
    parts: list[str] = []
    if idea.description and idea.description.strip():
        parts.append(idea.description.strip())
    meta: list[str] = []
    if idea.location and idea.location.strip():
        meta.append(f"Location: {idea.location.strip()}")
    if idea.category and idea.category.strip():
        meta.append(f"Category: {idea.category.strip()}")
    if idea.estimated_cost is not None:
        meta.append(f"Estimated cost: ${Decimal(str(idea.estimated_cost)):,.2f}")
    if meta:
        parts.append("\n".join(meta))
    return "\n\n".join(parts) if parts else None


async def _resolve_category_id(
    db: AsyncSession, company_id: str, category_name: Optional[str]
) -> str | None:
    name = (category_name or "").strip()
    if not name:
        return None
    rq = await db.execute(
        select(PulseCategory)
        .where(PulseCategory.company_id == company_id)
        .where(PulseCategory.name.ilike(name))
        .limit(1)
    )
    cat = rq.scalars().first()
    return str(cat.id) if cat else None


async def convert_idea_to_project(
    db: AsyncSession,
    company_id: str,
    actor: User,
    idea: PlanningIdea,
    *,
    owner_user_id: Optional[str],
    department_slug: Optional[str],
    target_start_date: date,
    target_end_date: Optional[date],
    template_id: Optional[str],
    project_status: str,
) -> tuple[PlanningIdea, PulseProject]:
    if idea.status == "converted" and idea.linked_project_id:
        raise ValueError("already converted")
    if idea.status != "approved":
        raise ValueError("idea must be approved before creating a project")
    end = target_end_date or (target_start_date + timedelta(days=90))
    if end < target_start_date:
        raise ValueError("end_date must be on or after start_date")
    owner = (owner_user_id or "").strip() or None
    if owner and not await proj_svc.user_in_company(db, company_id, owner):
        raise ValueError("owner not in organization")
    cat_id = await _resolve_category_id(db, company_id, idea.category)
    template: PulseProjectTemplate | None = None
    template_tasks: list[PulseProjectTemplateTask] = []
    tid = (template_id or "").strip() or None
    if tid:
        template = await db.get(PulseProjectTemplate, tid)
        if not template or str(template.company_id) != company_id:
            raise ValueError("template not found")
        tq = await db.execute(
            select(PulseProjectTemplateTask)
            .where(PulseProjectTemplateTask.template_id == tid)
            .order_by(PulseProjectTemplateTask.order_index.asc(), PulseProjectTemplateTask.created_at.asc())
        )
        template_tasks = list(tq.scalars().all())
    actor_hr = await db.get(PulseWorkerHR, str(actor.id))
    project_dept = (
        normalize_schedule_department_slug(department_slug)
        or primary_department_slug_from_hr(actor_hr)
        or DEFAULT_SCHEDULE_DEPARTMENT_SLUG
    )
    staffing = "high" if idea.priority in ("high", "critical") else "normal"
    impact = "high" if idea.priority == "critical" else "medium"
    p = PulseProject(
        company_id=company_id,
        name=idea.title.strip(),
        description=_build_project_description(idea),
        owner_user_id=owner or str(actor.id),
        created_by_user_id=str(actor.id),
        category_id=cat_id,
        start_date=target_start_date,
        end_date=end,
        status=proj_svc.parse_project_status(project_status or "future"),
        goal=f"Originated from planning idea {idea.id}",
        notes=f"Planning intake location: {idea.location or '—'}",
        show_on_schedule=True,
        operational_impact_level=impact,
        staffing_priority=staffing,
        department_slug=project_dept,
    )
    db.add(p)
    await db.flush()
    await seed_default_notification_rules(db, project_id=str(p.id), company_id=company_id)
    if template and template_tasks:
        for tt in template_tasks:
            db.add(
                PulseProjectTask(
                    company_id=company_id,
                    project_id=str(p.id),
                    title=tt.title,
                    description=tt.description,
                    assigned_user_id=None,
                    priority=proj_svc.parse_task_priority("medium"),
                    status=proj_svc.parse_task_status("todo"),
                    due_date=None,
                    estimated_duration=getattr(tt, "suggested_duration", None),
                    skill_type=getattr(tt, "skill_type", None),
                    material_notes=getattr(tt, "material_notes", None),
                    phase_group=getattr(tt, "phase_group", None),
                )
            )
    db.add(
        PulseProjectActivity(
            project_id=str(p.id),
            type=PulseProjectActivityType.note,
            title="Planning intake",
            description=f"Project created from Planning List idea “{idea.title}” (idea id {idea.id}).",
        )
    )
    now = datetime.now(timezone.utc)
    idea.status = "converted"
    idea.linked_project_id = str(p.id)
    idea.converted_at = now
    idea.updated_at = now
    await db.flush()
    return idea, p
