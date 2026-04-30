"""Tenant-scoped projects and tasks (`/api/v1/projects`, `/api/v1/tasks`)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.services.onboarding_service import try_mark_onboarding_step
from app.core.database import get_db
from app.models.domain import User
from app.models.pulse_models import (
    PulseCategory,
    PulseProject,
    PulseProjectActivity,
    PulseProjectActivityType,
    PulseProjectPhase,
    PulseProjectTemplate,
    PulseProjectTemplateTask,
    PulseProjectCriticalStep,
    PulseProjectAutomationRule,
    PulseProjectAutomationTrigger,
    PulseProjectStatus,
    PulseProjectTask,
    PulseTaskDependency,
    PulseTaskStatus,
)
from app.modules.pulse import accountability_service as acc_svc
from app.modules.pulse import project_automation_engine, project_service as proj_svc
from app.modules.pulse.ready_proximity import task_priority_str
from app.modules.pulse.task_dependencies import (
    compute_blocking_for_tasks,
    fetch_prerequisite_ids_for_tasks,
    task_blocking_state,
    task_to_out_enriched,
    would_create_cycle,
)
from app.schemas.projects import (
    CategoryCreateIn,
    CategoryOut,
    CriticalStepCreateIn,
    CriticalStepOut,
    CriticalStepPatch,
    AutomationRuleCreate,
    AutomationRuleOut,
    AutomationRulePatch,
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectOutWithProgress,
    ProjectPatch,
    ProjectActivityCreateNoteIn,
    ProjectActivityOut,
    ProjectTemplateCreateIn,
    ProjectTemplateDetailOut,
    ProjectTemplateOut,
    ProjectTemplateTaskOut,
    ReadyTaskOut,
    TaskBlockingMini,
    TaskCreate,
    TaskDependencyCreate,
    TaskDependencyOut,
    TaskHealthItem,
    TaskHealthReport,
    TaskOut,
    TaskPatch,
    task_orm_to_out,
)

router = APIRouter(tags=["projects"])
tasks_router = APIRouter(tags=["tasks"])


def _category_out(c: PulseCategory) -> CategoryOut:
    return CategoryOut(id=str(c.id), name=c.name, color=c.color, created_at=c.created_at)


def _critical_step_out(s: PulseProjectCriticalStep) -> CriticalStepOut:
    return CriticalStepOut(
        id=str(s.id),
        project_id=str(s.project_id),
        title=s.title,
        order_index=int(s.order_index or 0),
        depends_on_id=str(s.depends_on_id) if getattr(s, "depends_on_id", None) else None,
        created_at=s.created_at,
    )


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _norm_task_skill_names(raw: list[str] | None) -> list[str]:
    out: list[str] = []
    if not raw:
        return out
    seen_lower: set[str] = set()
    for x in raw:
        s = str(x).strip()
        if not s or len(s) > 128:
            continue
        low = s.lower()
        if low in seen_lower:
            continue
        seen_lower.add(low)
        out.append(s)
        if len(out) >= 24:
            break
    return out


def _project_out(p: PulseProject) -> ProjectOut:
    st = p.status.value if hasattr(p.status, "value") else str(p.status)
    return ProjectOut(
        id=str(p.id),
        company_id=str(p.company_id),
        name=p.name,
        description=p.description,
        owner_user_id=str(p.owner_user_id) if getattr(p, "owner_user_id", None) else None,
        created_by_user_id=str(p.created_by_user_id) if getattr(p, "created_by_user_id", None) else None,
        category_id=str(p.category_id) if getattr(p, "category_id", None) else None,
        category=None,
        start_date=p.start_date,
        end_date=p.end_date,
        goal=getattr(p, "goal", None),
        notes=getattr(p, "notes", None),
        success_definition=getattr(p, "success_definition", None),
        current_phase=getattr(getattr(p, "current_phase", None), "value", None)
        if getattr(p, "current_phase", None) is not None
        else None,
        summary=getattr(p, "summary", None),
        metrics=getattr(p, "metrics", None),
        lessons_learned=getattr(p, "lessons_learned", None),
        status=st,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: Db, cid: CompanyId) -> list[CategoryOut]:
    cq = await db.execute(select(PulseCategory).where(PulseCategory.company_id == cid).order_by(PulseCategory.name.asc()))
    rows = list(cq.scalars().all())
    return [_category_out(c) for c in rows]


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(db: Db, cid: CompanyId, body: CategoryCreateIn) -> CategoryOut:
    raw = body.name.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="name required")
    # Normalize to simple title case while preserving short words.
    norm = " ".join([w[:1].upper() + w[1:].lower() if w else "" for w in raw.split()]).strip()
    low = norm.lower()
    existing = (
        await db.execute(
            select(PulseCategory).where(PulseCategory.company_id == cid, func.lower(PulseCategory.name) == low).limit(1)
        )
    ).scalars().first()
    if existing:
        # If a color is provided and the existing category has none, fill it.
        if body.color and not existing.color:
            existing.color = body.color
            await db.commit()
            await db.refresh(existing)
        return _category_out(existing)
    c = PulseCategory(company_id=cid, name=norm, color=(body.color or "").strip() or None)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _category_out(c)


@router.get("/projects/{project_id}/critical-steps", response_model=list[CriticalStepOut])
async def list_critical_steps(db: Db, cid: CompanyId, project_id: str) -> list[CriticalStepOut]:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    rq = await db.execute(
        select(PulseProjectCriticalStep)
        .where(PulseProjectCriticalStep.project_id == project_id, PulseProjectCriticalStep.company_id == cid)
        .order_by(PulseProjectCriticalStep.order_index.asc(), PulseProjectCriticalStep.created_at.asc())
    )
    rows = list(rq.scalars().all())
    return [_critical_step_out(x) for x in rows]


@router.post("/projects/{project_id}/critical-steps", response_model=CriticalStepOut, status_code=201)
async def create_critical_step(db: Db, cid: CompanyId, project_id: str, body: CriticalStepCreateIn) -> CriticalStepOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    dep_id = (body.depends_on_id or "").strip() or None
    if dep_id:
        dep = await db.get(PulseProjectCriticalStep, dep_id)
        if not dep or str(dep.company_id) != cid or str(dep.project_id) != project_id:
            raise HTTPException(status_code=400, detail="depends_on_id not found")
    row = PulseProjectCriticalStep(
        company_id=cid,
        project_id=project_id,
        title=body.title.strip(),
        order_index=int(body.order_index or 0),
        depends_on_id=dep_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _critical_step_out(row)


@router.patch("/projects/{project_id}/critical-steps/{step_id}", response_model=CriticalStepOut)
async def patch_critical_step(
    db: Db, cid: CompanyId, project_id: str, step_id: str, body: CriticalStepPatch
) -> CriticalStepOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    row = await db.get(PulseProjectCriticalStep, step_id)
    if not row or str(row.company_id) != cid or str(row.project_id) != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        row.title = str(data["title"]).strip()
    if "order_index" in data and data["order_index"] is not None:
        row.order_index = int(data["order_index"])
    if "depends_on_id" in data:
        raw = data["depends_on_id"]
        v = str(raw).strip() if raw is not None else ""
        if not v:
            row.depends_on_id = None
        else:
            if v == str(row.id):
                raise HTTPException(status_code=400, detail="depends_on_id cannot be self")
            dep = await db.get(PulseProjectCriticalStep, v)
            if not dep or str(dep.company_id) != cid or str(dep.project_id) != project_id:
                raise HTTPException(status_code=400, detail="depends_on_id not found")
            row.depends_on_id = str(dep.id)
    await db.commit()
    await db.refresh(row)
    return _critical_step_out(row)


@router.delete("/projects/{project_id}/critical-steps/{step_id}", status_code=204)
async def delete_critical_step(db: Db, cid: CompanyId, project_id: str, step_id: str) -> None:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    row = await db.get(PulseProjectCriticalStep, step_id)
    if not row or str(row.company_id) != cid or str(row.project_id) != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseProjectCriticalStep).where(PulseProjectCriticalStep.id == step_id))
    await db.commit()
    return None


def _activity_out(a: PulseProjectActivity) -> ProjectActivityOut:
    ty = a.type.value if hasattr(a.type, "value") else str(a.type)
    return ProjectActivityOut(
        id=str(a.id),
        project_id=str(a.project_id),
        type=ty,
        title=a.title,
        description=a.description,
        impact_level=getattr(getattr(a, "impact_level", None), "value", None)
        if getattr(a, "impact_level", None) is not None
        else None,
        related_task_id=str(a.related_task_id) if getattr(a, "related_task_id", None) else None,
        created_at=a.created_at,
    )


async def _log_activity(
    db: Db,
    *,
    project_id: str,
    activity_type: PulseProjectActivityType,
    description: str,
    title: str | None = None,
    related_task_id: str | None = None,
) -> None:
    desc = (description or "").strip()
    if not desc:
        return
    row = PulseProjectActivity(
        project_id=project_id,
        type=activity_type,
        title=(title or "").strip() or None,
        description=desc,
        related_task_id=related_task_id,
    )
    db.add(row)
    await db.flush()


def _health_status(*, overdue_tasks: int, open_issues: int) -> str:
    if overdue_tasks > 0:
        return "At Risk"
    if open_issues > 0:
        return "Attention"
    return "On Track"


def _template_out(t: PulseProjectTemplate) -> ProjectTemplateOut:
    return ProjectTemplateOut(
        id=str(t.id),
        name=t.name,
        description=t.description,
        default_goal=getattr(t, "default_goal", None),
        default_notes=getattr(t, "default_notes", None),
        default_success_definition=getattr(t, "default_success_definition", None),
    )


def _template_task_out(r: PulseProjectTemplateTask) -> ProjectTemplateTaskOut:
    return ProjectTemplateTaskOut(
        id=str(r.id),
        template_id=str(r.template_id),
        title=r.title,
        description=r.description,
        suggested_duration=getattr(r, "suggested_duration", None),
        skill_type=getattr(r, "skill_type", None),
        material_notes=getattr(r, "material_notes", None),
        order_index=int(getattr(r, "order_index", 0) or 0),
        phase_group=getattr(r, "phase_group", None),
    )


@router.get("/project-templates", response_model=list[ProjectTemplateOut])
async def list_project_templates(db: Db, cid: CompanyId) -> list[ProjectTemplateOut]:
    tq = await db.execute(
        select(PulseProjectTemplate)
        .where(PulseProjectTemplate.company_id == cid)
        .order_by(PulseProjectTemplate.updated_at.desc(), PulseProjectTemplate.created_at.desc())
    )
    rows = list(tq.scalars().all())
    return [_template_out(t) for t in rows]


@router.get("/project-templates/{template_id}", response_model=ProjectTemplateDetailOut)
async def get_project_template(db: Db, cid: CompanyId, template_id: str) -> ProjectTemplateDetailOut:
    t = await db.get(PulseProjectTemplate, template_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    rq = await db.execute(
        select(PulseProjectTemplateTask)
        .where(PulseProjectTemplateTask.template_id == template_id)
        .order_by(PulseProjectTemplateTask.order_index.asc(), PulseProjectTemplateTask.created_at.asc())
    )
    tasks = list(rq.scalars().all())
    return ProjectTemplateDetailOut(**_template_out(t).model_dump(), tasks=[_template_task_out(x) for x in tasks])


@router.post("/project-templates", response_model=ProjectTemplateDetailOut, status_code=201)
async def create_project_template(
    db: Db,
    cid: CompanyId,
    body: ProjectTemplateCreateIn,
    actor: Annotated[User, Depends(require_tenant_user)],
) -> ProjectTemplateDetailOut:
    t = PulseProjectTemplate(
        company_id=cid,
        name=body.name.strip(),
        description=body.description,
        default_goal=body.default_goal,
        default_notes=body.default_notes,
        default_success_definition=body.default_success_definition,
    )
    db.add(t)
    await db.flush()
    for row in body.tasks or []:
        tt = PulseProjectTemplateTask(
            template_id=str(t.id),
            title=row.title.strip(),
            description=row.description,
            suggested_duration=row.suggested_duration,
            skill_type=row.skill_type,
            material_notes=row.material_notes,
            order_index=int(row.order_index or 0),
            phase_group=row.phase_group,
        )
        db.add(tt)
    await db.commit()
    await db.refresh(t)
    rq = await db.execute(
        select(PulseProjectTemplateTask)
        .where(PulseProjectTemplateTask.template_id == str(t.id))
        .order_by(PulseProjectTemplateTask.order_index.asc(), PulseProjectTemplateTask.created_at.asc())
    )
    tasks = list(rq.scalars().all())
    return ProjectTemplateDetailOut(**_template_out(t).model_dump(), tasks=[_template_task_out(x) for x in tasks])


def _parse_trigger(s: str) -> PulseProjectAutomationTrigger:
    try:
        return PulseProjectAutomationTrigger(s)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid trigger_type")


@router.get("/projects", response_model=list[ProjectOutWithProgress])
async def list_projects(db: Db, cid: CompanyId) -> list[ProjectOutWithProgress]:
    rows = (await db.execute(select(PulseProject).where(PulseProject.company_id == cid))).scalars().all()
    cat_ids = {str(p.category_id) for p in rows if getattr(p, "category_id", None)}
    cats: dict[str, PulseCategory] = {}
    if cat_ids:
        cq = await db.execute(select(PulseCategory).where(PulseCategory.id.in_(cat_ids)))
        cats = {str(c.id): c for c in cq.scalars().all()}
    last_q = await db.execute(
        select(PulseProjectActivity.project_id, func.max(PulseProjectActivity.created_at))
        .join(PulseProject, PulseProject.id == PulseProjectActivity.project_id)
        .where(PulseProject.company_id == cid)
        .group_by(PulseProjectActivity.project_id)
    )
    last_by_project = {str(pid): ts for (pid, ts) in last_q.all() if pid and ts}
    out: list[ProjectOutWithProgress] = []
    today = datetime.now(timezone.utc).date()
    for p in rows:
        tot_q = await db.scalar(
            select(func.count()).select_from(PulseProjectTask).where(PulseProjectTask.project_id == p.id)
        )
        done_q = await db.scalar(
            select(func.count())
            .select_from(PulseProjectTask)
            .where(
                PulseProjectTask.project_id == p.id,
                PulseProjectTask.status == PulseTaskStatus.complete,
            )
        )
        total = int(tot_q or 0)
        done = int(done_q or 0)
        pct = round(100 * done / total) if total else 0
        overdue_q = await db.scalar(
            select(func.count())
            .select_from(PulseProjectTask)
            .where(
                PulseProjectTask.project_id == p.id,
                PulseProjectTask.status != PulseTaskStatus.complete,
                PulseProjectTask.due_date.isnot(None),
                PulseProjectTask.due_date < today,
            )
        )
        overdue_ct = int(overdue_q or 0)
        issue_q = await db.scalar(
            select(func.count())
            .select_from(PulseProjectActivity)
            .where(
                PulseProjectActivity.project_id == p.id,
                PulseProjectActivity.type == PulseProjectActivityType.issue,
            )
        )
        issue_ct = int(issue_q or 0)
        st = p.status.value if hasattr(p.status, "value") else str(p.status)
        assignee_rows = (
            (
                await db.execute(
                    select(PulseProjectTask.assigned_user_id)
                    .where(
                        PulseProjectTask.project_id == p.id,
                        PulseProjectTask.assigned_user_id.isnot(None),
                    )
                    .distinct()
                )
            )
            .scalars()
            .all()
        )
        assignee_user_ids = [str(aid) for aid in assignee_rows if aid]
        out.append(
            ProjectOutWithProgress(
                id=str(p.id),
                company_id=str(p.company_id),
                name=p.name,
                description=p.description,
                owner_user_id=str(p.owner_user_id) if getattr(p, "owner_user_id", None) else None,
                created_by_user_id=str(p.created_by_user_id) if getattr(p, "created_by_user_id", None) else None,
                category_id=str(p.category_id) if getattr(p, "category_id", None) else None,
                category=_category_out(cats[str(p.category_id)]) if getattr(p, "category_id", None) and str(p.category_id) in cats else None,
                start_date=p.start_date,
                end_date=p.end_date,
                goal=getattr(p, "goal", None),
                notes=getattr(p, "notes", None),
                success_definition=getattr(p, "success_definition", None),
                current_phase=getattr(getattr(p, "current_phase", None), "value", None)
                if getattr(p, "current_phase", None) is not None
                else None,
                summary=getattr(p, "summary", None),
                metrics=getattr(p, "metrics", None),
                lessons_learned=getattr(p, "lessons_learned", None),
                status=st,
                created_at=p.created_at,
                updated_at=p.updated_at,
                task_total=total,
                task_completed=done,
                progress_pct=pct,
                assignee_user_ids=assignee_user_ids,
                last_activity_at=last_by_project.get(str(p.id)),
                health_status=_health_status(overdue_tasks=overdue_ct, open_issues=issue_ct),
            )
        )
    await db.commit()
    return out


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: ProjectCreate,
) -> ProjectOut:
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    owner_id = (body.owner_user_id or "").strip() or None
    if owner_id and not await proj_svc.user_in_company(db, cid, owner_id):
        raise HTTPException(status_code=400, detail="Owner not in organization")
    cat_id = (getattr(body, "category_id", None) or "").strip() or None
    if cat_id:
        c = await db.get(PulseCategory, cat_id)
        if not c or str(c.company_id) != cid:
            raise HTTPException(status_code=400, detail="Category not found")
    template_id = (getattr(body, "template_id", None) or "").strip() or None
    template: PulseProjectTemplate | None = None
    template_tasks: list[PulseProjectTemplateTask] = []
    if template_id:
        template = await db.get(PulseProjectTemplate, template_id)
        if not template or str(template.company_id) != cid:
            raise HTTPException(status_code=404, detail="Template not found")
        rq = await db.execute(
            select(PulseProjectTemplateTask)
            .where(PulseProjectTemplateTask.template_id == template_id)
            .order_by(PulseProjectTemplateTask.order_index.asc(), PulseProjectTemplateTask.created_at.asc())
        )
        template_tasks = list(rq.scalars().all())
    p = PulseProject(
        company_id=cid,
        name=body.name.strip(),
        description=body.description,
        owner_user_id=owner_id,
        created_by_user_id=str(actor.id),
        category_id=cat_id,
        start_date=body.start_date,
        end_date=body.end_date,
        status=proj_svc.parse_project_status(body.status or "active"),
        goal=getattr(template, "default_goal", None) if template else None,
        notes=getattr(template, "default_notes", None) if template else None,
        success_definition=getattr(template, "default_success_definition", None) if template else None,
    )
    db.add(p)
    await db.flush()
    if template and template_tasks:
        for tt in template_tasks:
            row = PulseProjectTask(
                company_id=cid,
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
            db.add(row)
    await db.commit()
    await db.refresh(p)
    out = _project_out(p)
    if getattr(p, "category_id", None):
        c = await db.get(PulseCategory, str(p.category_id))
        if c and str(c.company_id) == cid:
            out.category = _category_out(c)
    return out


@router.get("/projects/{project_id}", response_model=ProjectDetailOut)
async def get_project(db: Db, cid: CompanyId, project_id: str) -> ProjectDetailOut:
    await db.commit()
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    tq = await db.execute(
        select(PulseProjectTask)
        .where(PulseProjectTask.project_id == project_id)
        .order_by(PulseProjectTask.due_date.asc(), PulseProjectTask.created_at)
    )
    task_orms = list(tq.scalars().all())
    ids = [str(x.id) for x in task_orms]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    by_id = {str(t.id): t for t in task_orms}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)
    tasks: list[TaskOut] = []
    for t in task_orms:
        is_bl, blocking_orms = block_map[str(t.id)]
        mini = [
            TaskBlockingMini(
                id=str(b.id),
                title=b.title,
                status=b.status.value if hasattr(b.status, "value") else str(b.status),
            )
            for b in blocking_orms
        ]
        tasks.append(
            task_orm_to_out(
                t,
                is_blocked=is_bl,
                blocking_tasks=mini,
                depends_on_task_ids=prereq_map.get(str(t.id), []),
            )
        )
    st = p.status.value if hasattr(p.status, "value") else str(p.status)
    today = datetime.now(timezone.utc).date()
    overdue_ct = sum(
        1
        for t in task_orms
        if t.status != PulseTaskStatus.complete and t.due_date and t.due_date < today
    )
    issue_q = await db.scalar(
        select(func.count())
        .select_from(PulseProjectActivity)
        .where(
            PulseProjectActivity.project_id == project_id,
            PulseProjectActivity.type == PulseProjectActivityType.issue,
        )
    )
    issue_ct = int(issue_q or 0)
    cat = None
    if getattr(p, "category_id", None):
        c = await db.get(PulseCategory, str(p.category_id))
        if c and str(c.company_id) == cid:
            cat = _category_out(c)
    return ProjectDetailOut(
        id=str(p.id),
        company_id=str(p.company_id),
        name=p.name,
        description=p.description,
        owner_user_id=str(p.owner_user_id) if getattr(p, "owner_user_id", None) else None,
        created_by_user_id=str(p.created_by_user_id) if getattr(p, "created_by_user_id", None) else None,
        category_id=str(p.category_id) if getattr(p, "category_id", None) else None,
        category=cat,
        start_date=p.start_date,
        end_date=p.end_date,
        goal=getattr(p, "goal", None),
        notes=getattr(p, "notes", None),
        success_definition=getattr(p, "success_definition", None),
        current_phase=getattr(getattr(p, "current_phase", None), "value", None)
        if getattr(p, "current_phase", None) is not None
        else None,
        summary=getattr(p, "summary", None),
        metrics=getattr(p, "metrics", None),
        lessons_learned=getattr(p, "lessons_learned", None),
        status=st,
        created_at=p.created_at,
        updated_at=p.updated_at,
        health_status=_health_status(overdue_tasks=int(overdue_ct), open_issues=issue_ct),
        tasks=tasks,
    )


@router.get("/projects/{project_id}/activity", response_model=list[ProjectActivityOut])
async def list_project_activity(db: Db, cid: CompanyId, project_id: str) -> list[ProjectActivityOut]:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    aq = await db.execute(
        select(PulseProjectActivity)
        .where(PulseProjectActivity.project_id == project_id)
        .order_by(PulseProjectActivity.created_at.desc())
        .limit(200)
    )
    rows = list(aq.scalars().all())
    return [_activity_out(a) for a in rows]


@router.post("/projects/{project_id}/activity/notes", response_model=ProjectActivityOut, status_code=201)
async def create_project_note(
    db: Db,
    cid: CompanyId,
    project_id: str,
    body: ProjectActivityCreateNoteIn,
) -> ProjectActivityOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await _log_activity(
        db,
        project_id=project_id,
        activity_type=PulseProjectActivityType.note,
        title=body.title,
        description=body.description,
    )
    await db.commit()
    row = (
        await db.execute(
            select(PulseProjectActivity)
            .where(PulseProjectActivity.project_id == project_id)
            .order_by(PulseProjectActivity.created_at.desc())
            .limit(1)
        )
    ).scalars().first()
    assert row is not None
    return _activity_out(row)


@router.get("/projects/{project_id}/ready-tasks", response_model=list[ReadyTaskOut])
async def list_ready_tasks(db: Db, cid: CompanyId, project_id: str) -> list[ReadyTaskOut]:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    tq = await db.execute(
        select(PulseProjectTask)
        .where(PulseProjectTask.project_id == project_id)
        .order_by(PulseProjectTask.due_date.asc(), PulseProjectTask.created_at)
    )
    task_orms = list(tq.scalars().all())
    ids = [str(x.id) for x in task_orms]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    by_id = {str(t.id): t for t in task_orms}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)
    out: list[ReadyTaskOut] = []
    for t in task_orms:
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        if st != "todo":
            continue
        if block_map[str(t.id)][0]:
            continue
        loc = getattr(t, "location_tag_id", None)
        sop = getattr(t, "sop_id", None)
        out.append(
            ReadyTaskOut(
                id=str(t.id),
                title=t.title,
                priority=task_priority_str(t),
                assigned_to=str(t.assigned_user_id) if t.assigned_user_id else None,
                due_date=t.due_date,
                project_id=str(t.project_id),
                location_tag_id=str(loc).strip() if loc else None,
                sop_id=str(sop).strip() if sop else None,
            )
        )
    return out


@router.get("/projects/{project_id}/task-health", response_model=TaskHealthReport)
async def task_health(db: Db, cid: CompanyId, project_id: str) -> TaskHealthReport:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.project_id == project_id))
    task_orms = list(tq.scalars().all())
    ids = [str(x.id) for x in task_orms]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    needed: set[str] = set(ids)
    for i in ids:
        needed.update(prereq_map.get(i, []))
    if needed != set(ids):
        tq2 = await db.execute(select(PulseProjectTask).where(PulseProjectTask.id.in_(needed)))
        extra = list(tq2.scalars().all())
        by_id = {str(t.id): t for t in task_orms}
        for t in extra:
            by_id.setdefault(str(t.id), t)
    else:
        by_id = {str(t.id): t for t in task_orms}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    overdue: list[TaskHealthItem] = []
    stale: list[TaskHealthItem] = []
    blocked: list[TaskHealthItem] = []
    pname = p.name
    for t in task_orms:
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        if st == "complete":
            continue
        is_bl = block_map[str(t.id)][0]
        is_od = bool(t.due_date and t.due_date < today)
        is_st = bool((now - t.updated_at).total_seconds() > 86400)
        item = TaskHealthItem(
            id=str(t.id),
            project_id=str(t.project_id),
            project_name=pname,
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
    return TaskHealthReport(overdue=overdue, stale=stale, blocked=blocked)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def patch_project(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    project_id: str,
    body: ProjectPatch,
) -> ProjectOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    old_project_status = p.status
    if "status" in data and data["status"] is not None:
        new_st = proj_svc.parse_project_status(str(data["status"]))
        if new_st == PulseProjectStatus.completed:
            creator_id = getattr(p, "created_by_user_id", None)
            if not creator_id or str(creator_id) != str(actor.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the project creator can mark this project complete",
                )
        p.status = new_st
        del data["status"]
    if "owner_user_id" in data:
        uid = data.pop("owner_user_id")
        owner_id = str(uid).strip() if uid else None
        if owner_id and not await proj_svc.user_in_company(db, cid, owner_id):
            raise HTTPException(status_code=400, detail="Owner not in organization")
        p.owner_user_id = owner_id or None
    if "category_id" in data:
        raw = data.pop("category_id")
        v = str(raw).strip() if raw is not None else ""
        if not v:
            p.category_id = None
        else:
            c = await db.get(PulseCategory, v)
            if not c or str(c.company_id) != cid:
                raise HTTPException(status_code=400, detail="Category not found")
            p.category_id = str(c.id)
    if "current_phase" in data:
        raw = data.pop("current_phase")
        v = str(raw).strip() if raw is not None else ""
        if not v:
            p.current_phase = None
        else:
            try:
                p.current_phase = PulseProjectPhase(v)
            except ValueError:
                raise HTTPException(status_code=400, detail="invalid current_phase")
    for k, v in data.items():
        if v is not None:
            setattr(p, k, v)
    if p.end_date < p.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    if (
        old_project_status != PulseProjectStatus.completed
        and p.status == PulseProjectStatus.completed
    ):
        await _log_activity(
            db,
            project_id=str(p.id),
            activity_type=PulseProjectActivityType.note,
            title="Project completed",
            description="Project marked complete.",
        )
    await db.commit()
    await db.refresh(p)
    out = _project_out(p)
    if getattr(p, "category_id", None):
        c = await db.get(PulseCategory, str(p.category_id))
        if c and str(c.company_id) == cid:
            out.category = _category_out(c)
    return out


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    project_id: str,
) -> None:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    creator_id = getattr(p, "created_by_user_id", None)
    if not creator_id or str(creator_id) != str(actor.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project creator can delete this project",
        )
    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.project_id == project_id))
    for t in tq.scalars().all():
        await proj_svc.delete_calendar_shift_for_task(db, t)
    await db.execute(delete(PulseProject).where(PulseProject.id == project_id))
    await db.commit()


# —— Automation rules (project-scoped) ——


@router.get("/projects/{project_id}/automation-rules", response_model=list[AutomationRuleOut])
async def list_automation_rules(db: Db, cid: CompanyId, project_id: str) -> list[AutomationRuleOut]:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    rq = await db.execute(
        select(PulseProjectAutomationRule)
        .where(PulseProjectAutomationRule.project_id == project_id)
        .order_by(PulseProjectAutomationRule.created_at)
    )
    rows = rq.scalars().all()
    return [_automation_rule_out(r) for r in rows]


def _automation_rule_out(r: PulseProjectAutomationRule) -> AutomationRuleOut:
    trig = r.trigger_type.value if hasattr(r.trigger_type, "value") else str(r.trigger_type)
    cond = r.condition_json if isinstance(r.condition_json, dict) else {}
    act = r.action_json if isinstance(r.action_json, dict) else {}
    return AutomationRuleOut(
        id=str(r.id),
        project_id=str(r.project_id),
        trigger_type=trig,
        condition_json=cond,
        action_json=act,
        is_active=bool(r.is_active),
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.post("/projects/{project_id}/automation-rules", response_model=AutomationRuleOut, status_code=201)
async def create_automation_rule(
    db: Db, cid: CompanyId, project_id: str, body: AutomationRuleCreate
) -> AutomationRuleOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    trig = _parse_trigger(body.trigger_type.strip())
    row = PulseProjectAutomationRule(
        project_id=project_id,
        trigger_type=trig,
        condition_json=dict(body.condition_json or {}),
        action_json=dict(body.action_json or {}),
        is_active=body.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _automation_rule_out(row)


@router.patch("/projects/{project_id}/automation-rules/{rule_id}", response_model=AutomationRuleOut)
async def patch_automation_rule(
    db: Db, cid: CompanyId, project_id: str, rule_id: str, body: AutomationRulePatch
) -> AutomationRuleOut:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    r = await db.get(PulseProjectAutomationRule, rule_id)
    if not r or str(r.project_id) != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "trigger_type" in data and data["trigger_type"] is not None:
        r.trigger_type = _parse_trigger(str(data["trigger_type"]))
    if "condition_json" in data and data["condition_json"] is not None:
        r.condition_json = dict(data["condition_json"])
    if "action_json" in data and data["action_json"] is not None:
        r.action_json = dict(data["action_json"])
    if "is_active" in data and data["is_active"] is not None:
        r.is_active = bool(data["is_active"])
    await db.commit()
    await db.refresh(r)
    return _automation_rule_out(r)


@router.delete("/projects/{project_id}/automation-rules/{rule_id}", status_code=204)
async def delete_automation_rule(db: Db, cid: CompanyId, project_id: str, rule_id: str) -> None:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    r = await db.get(PulseProjectAutomationRule, rule_id)
    if not r or str(r.project_id) != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseProjectAutomationRule).where(PulseProjectAutomationRule.id == rule_id))
    await db.commit()


# —— Tasks ——


@tasks_router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: TaskCreate,
) -> TaskOut:
    proj = await db.get(PulseProject, body.project_id)
    if not proj or str(proj.company_id) != cid:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.assigned_user_id and not await proj_svc.user_in_company(db, cid, body.assigned_user_id):
        raise HTTPException(status_code=400, detail="Assigned user not in organization")
    loc = (body.location_tag_id.strip() if body.location_tag_id else None) or None
    sop = (body.sop_id.strip() if body.sop_id else None) or None
    skills = _norm_task_skill_names(body.required_skill_names)
    t = PulseProjectTask(
        company_id=cid,
        project_id=body.project_id,
        title=body.title.strip(),
        description=body.description,
        assigned_user_id=body.assigned_user_id,
        priority=proj_svc.parse_task_priority(body.priority or "medium"),
        status=proj_svc.parse_task_status(body.status or "todo"),
        due_date=body.due_date,
        estimated_duration=(body.estimated_duration or "").strip() or None,
        skill_type=(body.skill_type or "").strip() or None,
        material_notes=body.material_notes,
        phase_group=(body.phase_group or "").strip() or None,
        planned_start_at=body.planned_start_at,
        planned_end_at=body.planned_end_at,
        location_tag_id=loc,
        sop_id=sop,
        required_skill_names=skills,
    )
    db.add(t)
    await db.flush()
    await _log_activity(
        db,
        project_id=str(t.project_id),
        activity_type=PulseProjectActivityType.task,
        title=t.title,
        description=(t.description or "").strip() or f"Task created: {t.title}",
        related_task_id=str(t.id),
    )
    await proj_svc.ensure_calendar_shift_for_task(db, cid, t)
    await try_mark_onboarding_step(db, str(actor.id), "customize_workflow")
    await db.commit()
    await db.refresh(t)
    return await task_to_out_enriched(db, t)


@tasks_router.patch("/tasks/{task_id}", response_model=TaskOut)
async def patch_task(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    task_id: str,
    body: TaskPatch,
) -> TaskOut:
    t = await db.get(PulseProjectTask, task_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    old_status = t.status
    old_due = t.due_date
    data = body.model_dump(exclude_unset=True)
    if "assigned_user_id" in data:
        uid = data["assigned_user_id"]
        if uid and not await proj_svc.user_in_company(db, cid, uid):
            raise HTTPException(status_code=400, detail="Assigned user not in organization")
        t.assigned_user_id = uid
    if "priority" in data and data["priority"] is not None:
        t.priority = proj_svc.parse_task_priority(str(data["priority"]))
    if "status" in data and data["status"] is not None:
        new_st = proj_svc.parse_task_status(str(data["status"]))
        if new_st == PulseTaskStatus.complete:
            blocked, _ = await task_blocking_state(db, t)
            if blocked:
                raise HTTPException(
                    status_code=400,
                    detail="Task is blocked by incomplete dependencies",
                )
        t.status = new_st
        if new_st == PulseTaskStatus.in_progress and old_status != PulseTaskStatus.in_progress:
            await acc_svc.resolve_proximity_for_task(db, cid, str(actor.id), task_id)
    if "title" in data and data["title"] is not None:
        t.title = data["title"].strip()
    if "description" in data:
        t.description = data["description"]
    if "due_date" in data:
        t.due_date = data["due_date"]
    if "estimated_duration" in data:
        v = data["estimated_duration"]
        t.estimated_duration = (str(v).strip() or None) if v is not None else None
    if "skill_type" in data:
        v = data["skill_type"]
        t.skill_type = (str(v).strip() or None) if v is not None else None
    if "material_notes" in data:
        t.material_notes = data["material_notes"]
    if "phase_group" in data:
        v = data["phase_group"]
        t.phase_group = (str(v).strip() or None) if v is not None else None
    if "planned_start_at" in data:
        t.planned_start_at = data["planned_start_at"]
    if "planned_end_at" in data:
        t.planned_end_at = data["planned_end_at"]
    if "location_tag_id" in data:
        v = data["location_tag_id"]
        t.location_tag_id = (str(v).strip() or None) if v is not None else None
    if "sop_id" in data:
        v = data["sop_id"]
        t.sop_id = (str(v).strip() or None) if v is not None else None
    if "required_skill_names" in data and data["required_skill_names"] is not None:
        t.required_skill_names = _norm_task_skill_names(list(data["required_skill_names"]))
    await db.flush()
    await proj_svc.ensure_calendar_shift_for_task(db, cid, t)
    await project_automation_engine.run_rules_for_task_change(db, cid, t, old_status, old_due)
    if old_status != PulseTaskStatus.complete and t.status == PulseTaskStatus.complete:
        await _log_activity(
            db,
            project_id=str(t.project_id),
            activity_type=PulseProjectActivityType.task,
            title=t.title,
            description=f"Task completed: {t.title}",
            related_task_id=str(t.id),
        )
    await db.commit()
    await db.refresh(t)
    return await task_to_out_enriched(db, t)


@tasks_router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(db: Db, cid: CompanyId, task_id: str) -> None:
    t = await db.get(PulseProjectTask, task_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await proj_svc.delete_calendar_shift_for_task(db, t)
    await db.execute(delete(PulseProjectTask).where(PulseProjectTask.id == task_id))
    await db.commit()


# —— Task dependencies ——


@tasks_router.get("/tasks/{task_id}/dependencies", response_model=list[TaskDependencyOut])
async def list_task_dependencies(db: Db, cid: CompanyId, task_id: str) -> list[TaskDependencyOut]:
    t = await db.get(PulseProjectTask, task_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    dq = await db.execute(select(PulseTaskDependency).where(PulseTaskDependency.task_id == task_id))
    deps = list(dq.scalars().all())
    if not deps:
        return []
    need = [str(d.depends_on_task_id) for d in deps]
    tq = await db.execute(select(PulseProjectTask.id, PulseProjectTask.title).where(PulseProjectTask.id.in_(need)))
    titles = {str(r[0]): r[1] for r in tq.all()}
    return [
        TaskDependencyOut(
            id=str(d.id),
            task_id=str(d.task_id),
            depends_on_task_id=str(d.depends_on_task_id),
            depends_on_title=titles.get(str(d.depends_on_task_id), ""),
        )
        for d in deps
    ]


@tasks_router.post("/tasks/{task_id}/dependencies", response_model=TaskDependencyOut, status_code=201)
async def add_task_dependency(
    db: Db, cid: CompanyId, task_id: str, body: TaskDependencyCreate
) -> TaskDependencyOut:
    t = await db.get(PulseProjectTask, task_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    prereq_id = body.depends_on_task_id.strip()
    if prereq_id == task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")
    pre = await db.get(PulseProjectTask, prereq_id)
    if not pre or str(pre.company_id) != cid or str(pre.project_id) != str(t.project_id):
        raise HTTPException(status_code=400, detail="Prerequisite task not in this project")
    dup_ct = await db.scalar(
        select(func.count())
        .select_from(PulseTaskDependency)
        .where(
            PulseTaskDependency.task_id == task_id,
            PulseTaskDependency.depends_on_task_id == prereq_id,
        )
    )
    if dup_ct and int(dup_ct) > 0:
        raise HTTPException(status_code=400, detail="Dependency already exists")
    if await would_create_cycle(db, str(t.project_id), task_id, prereq_id):
        raise HTTPException(status_code=400, detail="Dependency would create a cycle")
    row = PulseTaskDependency(task_id=task_id, depends_on_task_id=prereq_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return TaskDependencyOut(
        id=str(row.id),
        task_id=str(row.task_id),
        depends_on_task_id=str(row.depends_on_task_id),
        depends_on_title=pre.title,
    )


@tasks_router.delete("/tasks/{task_id}/dependencies/{dependency_id}", status_code=204)
async def remove_task_dependency(db: Db, cid: CompanyId, task_id: str, dependency_id: str) -> None:
    t = await db.get(PulseProjectTask, task_id)
    if not t or str(t.company_id) != cid:
        raise HTTPException(status_code=404, detail="Not found")
    dq = await db.execute(
        delete(PulseTaskDependency).where(
            PulseTaskDependency.id == dependency_id,
            PulseTaskDependency.task_id == task_id,
        )
    )
    if dq.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await db.commit()
