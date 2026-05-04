"""Project completion: archive source project and optional annual structure clone.

Pure helpers and async DB orchestration live here so API routes stay thin and logic is testable.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulseProject,
    PulseProjectCriticalStep,
    PulseProjectStatus,
    PulseProjectTask,
    PulseProjectTaskEquipment,
    PulseProjectTaskMaterial,
    PulseTaskDependency,
    PulseTaskStatus,
)


def is_annual_project(project: PulseProject) -> bool:
    """Annual / yearly repopulation projects (excludes one-shot and blank)."""
    raw = (getattr(project, "repopulation_frequency", None) or "").strip().lower()
    if not raw or raw in ("once", "one-time", "one time"):
        return False
    return raw in ("annual", "yearly")


def next_period_start_date(cur: date, freq: str) -> date:
    """Advance ``cur`` by the calendar period implied by ``freq`` (months-based)."""
    f = (freq or "").strip().lower()
    if f in ("quarterly", "quarter"):
        months = 3
    elif f in ("semi-annual", "semiannual", "semi annual"):
        months = 6
    elif f in ("annual", "yearly"):
        months = 12
    else:
        months = 0
    if months <= 0:
        return cur
    y = cur.year
    m = cur.month + months
    while m > 12:
        y += 1
        m -= 12
    d = cur.day
    for day in (d, 28, 27, 26, 25):
        try:
            return cur.replace(year=y, month=m, day=day)
        except ValueError:
            continue
    return cur.replace(year=y, month=m, day=1)


def apply_archived_state(project: PulseProject, *, archived_at: datetime) -> None:
    """Move project into archived terminal state (caller sets ``completed_at`` earlier)."""
    project.status = PulseProjectStatus.archived
    project.archived_at = archived_at


async def clone_annual_project_structure(
    db: AsyncSession,
    *,
    source: PulseProject,
    company_id: str,
    actor_user_id: str,
    new_start: date,
    new_end: date,
    frequency: str,
) -> PulseProject:
    """Duplicate project shell + tasks/materials/equipment/critical path/deps — no activity or summaries."""
    freq = frequency.strip()
    new_proj = PulseProject(
        company_id=company_id,
        name=source.name,
        description=source.description,
        owner_user_id=str(source.owner_user_id) if getattr(source, "owner_user_id", None) else None,
        created_by_user_id=actor_user_id,
        category_id=str(source.category_id) if getattr(source, "category_id", None) else None,
        start_date=new_start,
        end_date=new_end,
        status=PulseProjectStatus.future,
        repopulation_frequency=freq,
        goal=getattr(source, "goal", None),
        notes=getattr(source, "notes", None),
        success_definition=getattr(source, "success_definition", None),
        current_phase=getattr(source, "current_phase", None),
        notification_enabled=bool(getattr(source, "notification_enabled", False)),
        notification_material_days=int(getattr(source, "notification_material_days", 30) or 30),
        notification_equipment_days=int(getattr(source, "notification_equipment_days", 7) or 7),
        notification_to_supervision=bool(getattr(source, "notification_to_supervision", False)),
        notification_to_lead=bool(getattr(source, "notification_to_lead", False)),
        notification_to_owner=bool(getattr(source, "notification_to_owner", True)),
    )
    db.add(new_proj)
    await db.flush()

    # Critical steps (structure): remap dependency ids after first insert.
    cs_q = await db.execute(
        select(PulseProjectCriticalStep)
        .where(PulseProjectCriticalStep.project_id == str(source.id))
        .order_by(PulseProjectCriticalStep.order_index.asc(), PulseProjectCriticalStep.created_at.asc())
    )
    old_steps = list(cs_q.scalars().all())
    step_old_to_new: dict[str, str] = {}
    for s in old_steps:
        ns = PulseProjectCriticalStep(
            company_id=company_id,
            project_id=str(new_proj.id),
            title=s.title,
            order_index=int(s.order_index or 0),
            depends_on_id=None,
        )
        db.add(ns)
        await db.flush()
        step_old_to_new[str(s.id)] = str(ns.id)
    for s in old_steps:
        new_id = step_old_to_new.get(str(s.id))
        dep_old = getattr(s, "depends_on_id", None)
        if not new_id or not dep_old:
            continue
        dep_new = step_old_to_new.get(str(dep_old))
        if not dep_new:
            continue
        nrow = await db.get(PulseProjectCriticalStep, new_id)
        if nrow is not None:
            nrow.depends_on_id = dep_new
    await db.flush()

    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.project_id == str(source.id)))
    old_tasks = list(tq.scalars().all())
    old_to_new_task: dict[str, str] = {}
    for ot in old_tasks:
        nt = PulseProjectTask(
            company_id=company_id,
            project_id=str(new_proj.id),
            title=ot.title,
            description=ot.description,
            assigned_user_id=ot.assigned_user_id,
            priority=ot.priority,
            status=PulseTaskStatus.todo,
            start_date=new_start,
            estimated_completion_minutes=getattr(ot, "estimated_completion_minutes", None),
            due_date=None,
            estimated_duration=getattr(ot, "estimated_duration", None),
            skill_type=getattr(ot, "skill_type", None),
            material_notes=getattr(ot, "material_notes", None),
            phase_group=getattr(ot, "phase_group", None),
            planned_start_at=None,
            planned_end_at=None,
            end_date=None,
            actual_completion_minutes=None,
            location_tag_id=getattr(ot, "location_tag_id", None),
            sop_id=getattr(ot, "sop_id", None),
            required_skill_names=getattr(ot, "required_skill_names", None) or [],
            calendar_shift_id=None,
        )
        db.add(nt)
        await db.flush()
        old_to_new_task[str(ot.id)] = str(nt.id)

        mq = await db.execute(
            select(PulseProjectTaskMaterial).where(PulseProjectTaskMaterial.task_id == str(ot.id))
        )
        for m in mq.scalars().all():
            nm = PulseProjectTaskMaterial(
                company_id=company_id,
                project_id=str(new_proj.id),
                task_id=str(nt.id),
                inventory_item_id=m.inventory_item_id,
                name=m.name,
                quantity_required=m.quantity_required,
                unit=m.unit,
                notes=m.notes,
            )
            db.add(nm)
        eq_q = await db.execute(
            select(PulseProjectTaskEquipment).where(PulseProjectTaskEquipment.task_id == str(ot.id))
        )
        for e in eq_q.scalars().all():
            ne = PulseProjectTaskEquipment(
                company_id=company_id,
                project_id=str(new_proj.id),
                task_id=str(nt.id),
                facility_equipment_id=e.facility_equipment_id,
                name=e.name,
                notes=e.notes,
            )
            db.add(ne)
    await db.flush()

    old_task_ids = set(old_to_new_task.keys())
    if old_task_ids:
        dep_q = await db.execute(
            select(PulseTaskDependency).where(PulseTaskDependency.task_id.in_(old_task_ids))
        )
        for dep in dep_q.scalars().all():
            new_tid = old_to_new_task.get(str(dep.task_id))
            new_prereq = old_to_new_task.get(str(dep.depends_on_task_id))
            if not new_tid or not new_prereq or new_tid == new_prereq:
                continue
            db.add(PulseTaskDependency(task_id=new_tid, depends_on_task_id=new_prereq))
        await db.flush()

    return new_proj


async def complete_and_archive_pulse_project(
    db: AsyncSession,
    *,
    project: PulseProject,
    company_id: str,
    actor_user_id: str,
    completed_at: datetime,
) -> Optional[PulseProject]:
    """Set completion timestamps, optionally clone annual successor, then archive ``project``.

    Returns the new future project when an annual clone was created, else ``None``.
    Caller should persist (commit) the session.
    """
    project.completed_at = completed_at
    clone: Optional[PulseProject] = None
    freq = (getattr(project, "repopulation_frequency", None) or "").strip()
    if is_annual_project(project) and freq:
        dur_days = max(0, int((project.end_date - project.start_date).days))
        ns = next_period_start_date(project.start_date, freq)
        ne = date.fromordinal(ns.toordinal() + dur_days)
        clone = await clone_annual_project_structure(
            db,
            source=project,
            company_id=company_id,
            actor_user_id=actor_user_id,
            new_start=ns,
            new_end=ne,
            frequency=freq,
        )
    apply_archived_state(project, archived_at=datetime.now(timezone.utc))
    return clone
