"""
Internal PM coordination API — `pm_coord_*` tables, gated by `user.can_use_pm_features`.

Does not expose data to users without the flag. Parallel to `pulse_projects` (no automatic link).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_pm_features_user
from app.models.domain import InventoryItem, Tool, User
from app.models.pm_coord_models import (
    PmCoordProject,
    PmCoordRisk,
    PmCoordTask,
    PmCoordTaskDependency,
    PmCoordTaskResource,
    PmCoordTaskStatus,
    PmCoordResourceKind,
)
from app.schemas.pm_coord import (
    PmCoordDependencyCreate,
    PmCoordProjectCreate,
    PmCoordProjectDetailOut,
    PmCoordProjectPatch,
    PmCoordProjectSummaryOut,
    PmCoordResourceCreate,
    PmCoordResourcePatch,
    PmCoordRiskCreate,
    PmCoordRiskOut,
    PmCoordRiskPatch,
    PmCoordTaskCreate,
    PmCoordTaskOut,
    PmCoordTaskPatch,
    PmCoordTaskResourceOut,
)
from app.services.pm_coord_service import prerequisite_ids_for_tasks, would_create_cycle_pm_coord

router = APIRouter(prefix="/pm-coord", tags=["pm-coordination"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_project_for_company(
    db: AsyncSession, company_id: str, project_id: str
) -> PmCoordProject:
    q = await db.execute(
        select(PmCoordProject).where(
            PmCoordProject.id == project_id,
            PmCoordProject.company_id == company_id,
        )
    )
    p = q.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


async def _get_task_for_company(
    db: AsyncSession, company_id: str, task_id: str
) -> PmCoordTask:
    q = await db.execute(
        select(PmCoordTask).where(PmCoordTask.id == task_id, PmCoordTask.company_id == company_id)
    )
    t = q.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t


@router.get("/projects", response_model=list[PmCoordProjectSummaryOut])
async def list_projects(
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PmCoordProjectSummaryOut]:
    cid = str(user.company_id)
    q = await db.execute(
        select(PmCoordProject).where(PmCoordProject.company_id == cid).order_by(PmCoordProject.updated_at.desc())
    )
    rows = list(q.scalars().all())
    return [PmCoordProjectSummaryOut.model_validate(r) for r in rows]


@router.post("/projects", response_model=PmCoordProjectDetailOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: PmCoordProjectCreate,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    p = PmCoordProject(
        id=str(uuid4()),
        company_id=cid,
        name=body.name.strip(),
        objective=body.objective,
        deliverables=body.deliverables,
        definition_of_done=body.definition_of_done,
        created_by_user_id=str(user.id),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return await get_project(str(p.id), user, db)


@router.get("/projects/{project_id}", response_model=PmCoordProjectDetailOut)
async def get_project(
    project_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    p = await _get_project_for_company(db, cid, project_id)

    tq = await db.execute(
        select(PmCoordTask).where(PmCoordTask.project_id == project_id).order_by(
            PmCoordTask.sort_order.asc(), PmCoordTask.created_at.asc()
        )
    )
    tasks = list(tq.scalars().all())
    task_ids = [str(t.id) for t in tasks]
    prereq_map = await prerequisite_ids_for_tasks(db, task_ids)

    res_by_task: dict[str, list[PmCoordTaskResource]] = {}
    if task_ids:
        rq = await db.execute(select(PmCoordTaskResource).where(PmCoordTaskResource.task_id.in_(task_ids)))
        for r in rq.scalars().all():
            res_by_task.setdefault(str(r.task_id), []).append(r)

    task_out: list[PmCoordTaskOut] = []
    for t in tasks:
        resources = [
            PmCoordTaskResourceOut.model_validate(x) for x in res_by_task.get(str(t.id), [])
        ]
        task_out.append(
            PmCoordTaskOut(
                id=str(t.id),
                project_id=str(t.project_id),
                parent_task_id=str(t.parent_task_id) if t.parent_task_id else None,
                title=t.title,
                description=t.description,
                status=t.status,
                sort_order=t.sort_order,
                depends_on_task_ids=prereq_map.get(str(t.id), []),
                created_at=t.created_at,
                updated_at=t.updated_at,
                resources=resources,
            )
        )

    risks_q = await db.execute(
        select(PmCoordRisk).where(PmCoordRisk.project_id == project_id).order_by(PmCoordRisk.created_at.asc())
    )
    risks = [PmCoordRiskOut.model_validate(r) for r in risks_q.scalars().all()]

    return PmCoordProjectDetailOut(
        id=str(p.id),
        company_id=str(p.company_id),
        name=p.name,
        objective=p.objective,
        deliverables=p.deliverables,
        definition_of_done=p.definition_of_done,
        current_update=p.current_update,
        post_project_review=p.post_project_review,
        readiness_tasks_defined=p.readiness_tasks_defined,
        readiness_materials_ready=p.readiness_materials_ready,
        readiness_dependencies_set=p.readiness_dependencies_set,
        created_by_user_id=str(p.created_by_user_id) if p.created_by_user_id else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
        tasks=task_out,
        risks=risks,
    )


@router.patch("/projects/{project_id}", response_model=PmCoordProjectDetailOut)
async def patch_project(
    project_id: str,
    body: PmCoordProjectPatch,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    p = await _get_project_for_company(db, cid, project_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    p.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    cid = str(user.company_id)
    p = await _get_project_for_company(db, cid, project_id)
    await db.delete(p)
    await db.commit()


@router.post("/projects/{project_id}/tasks", response_model=PmCoordProjectDetailOut)
async def create_task(
    project_id: str,
    body: PmCoordTaskCreate,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    await _get_project_for_company(db, cid, project_id)

    st = body.status or PmCoordTaskStatus.not_started.value
    parent_id: Optional[str] = None
    if body.parent_task_id:
        pt = await _get_task_for_company(db, cid, body.parent_task_id)
        if str(pt.project_id) != project_id:
            raise HTTPException(status_code=400, detail="parent_task must belong to this project")

        async def _walk_chain(tid: str, depth: int) -> None:
            if depth > 32:
                raise HTTPException(status_code=400, detail="parent chain too deep")
            q = await db.execute(select(PmCoordTask).where(PmCoordTask.id == tid))
            row = q.scalar_one_or_none()
            if not row or str(row.project_id) != project_id:
                return
            if row.parent_task_id:
                await _walk_chain(str(row.parent_task_id), depth + 1)

        await _walk_chain(str(pt.id), 0)
        parent_id = str(pt.id)

    t = PmCoordTask(
        id=str(uuid4()),
        company_id=cid,
        project_id=project_id,
        parent_task_id=parent_id,
        title=body.title.strip(),
        description=body.description,
        status=st,
        sort_order=body.sort_order if body.sort_order is not None else 0,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(t)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.patch("/tasks/{task_id}", response_model=PmCoordProjectDetailOut)
async def patch_task(
    task_id: str,
    body: PmCoordTaskPatch,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    t = await _get_task_for_company(db, cid, task_id)
    project_id = str(t.project_id)

    data = body.model_dump(exclude_unset=True)
    if "parent_task_id" in data:
        pid = data["parent_task_id"]
        if pid is not None:
            if pid == task_id:
                raise HTTPException(status_code=400, detail="task cannot be its own parent")
            pt = await _get_task_for_company(db, cid, pid)
            if str(pt.project_id) != project_id:
                raise HTTPException(status_code=400, detail="parent_task must belong to this project")
        t.parent_task_id = pid

    if "title" in data and data["title"] is not None:
        t.title = data["title"].strip()
    if "description" in data:
        t.description = data["description"]
    if "status" in data and data["status"] is not None:
        t.status = data["status"]
    if "sort_order" in data and data["sort_order"] is not None:
        t.sort_order = data["sort_order"]

    t.updated_at = _now()
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.delete("/tasks/{task_id}", response_model=PmCoordProjectDetailOut)
async def delete_task(
    task_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    t = await _get_task_for_company(db, cid, task_id)
    project_id = str(t.project_id)
    await db.delete(t)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.post("/tasks/{task_id}/dependencies", response_model=PmCoordProjectDetailOut)
async def add_task_dependency(
    task_id: str,
    body: PmCoordDependencyCreate,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    t = await _get_task_for_company(db, cid, task_id)
    prereq = await _get_task_for_company(db, cid, body.depends_on_task_id)
    project_id = str(t.project_id)
    if str(prereq.project_id) != project_id:
        raise HTTPException(status_code=400, detail="Prerequisite task must be in the same project")

    if await would_create_cycle_pm_coord(db, project_id, task_id, body.depends_on_task_id):
        raise HTTPException(status_code=400, detail="Dependency would create a cycle")

    existing = await db.execute(
        select(PmCoordTaskDependency).where(
            PmCoordTaskDependency.task_id == task_id,
            PmCoordTaskDependency.depends_on_task_id == body.depends_on_task_id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(
            PmCoordTaskDependency(
                id=str(uuid4()),
                task_id=task_id,
                depends_on_task_id=body.depends_on_task_id,
            )
        )
        proj = await _get_project_for_company(db, cid, project_id)
        proj.updated_at = _now()
        await db.commit()
    return await get_project(project_id, user, db)


@router.delete(
    "/tasks/{task_id}/dependencies/{prerequisite_task_id}",
    response_model=PmCoordProjectDetailOut,
)
async def remove_task_dependency(
    task_id: str,
    prerequisite_task_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    t = await _get_task_for_company(db, cid, task_id)
    project_id = str(t.project_id)
    await db.execute(
        delete(PmCoordTaskDependency).where(
            PmCoordTaskDependency.task_id == task_id,
            PmCoordTaskDependency.depends_on_task_id == prerequisite_task_id,
        )
    )
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.post("/projects/{project_id}/risks", response_model=PmCoordProjectDetailOut)
async def create_risk(
    project_id: str,
    body: PmCoordRiskCreate,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    await _get_project_for_company(db, cid, project_id)
    r = PmCoordRisk(
        id=str(uuid4()),
        company_id=cid,
        project_id=project_id,
        risk_description=body.risk_description.strip(),
        impact=body.impact,
        mitigation_notes=body.mitigation_notes,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(r)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.patch("/risks/{risk_id}", response_model=PmCoordProjectDetailOut)
async def patch_risk(
    risk_id: str,
    body: PmCoordRiskPatch,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    q = await db.execute(select(PmCoordRisk).where(PmCoordRisk.id == risk_id, PmCoordRisk.company_id == cid))
    r = q.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Risk not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(r, k, v)
    r.updated_at = _now()
    project_id = str(r.project_id)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.delete("/risks/{risk_id}", response_model=PmCoordProjectDetailOut)
async def delete_risk(
    risk_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    q = await db.execute(select(PmCoordRisk).where(PmCoordRisk.id == risk_id, PmCoordRisk.company_id == cid))
    r = q.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Risk not found")
    project_id = str(r.project_id)
    await db.delete(r)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


async def _validate_inventory_tool_company(
    db: AsyncSession,
    company_id: str,
    inventory_item_id: Optional[str],
    tool_id: Optional[str],
) -> None:
    if inventory_item_id:
        iq = await db.execute(
            select(InventoryItem).where(InventoryItem.id == inventory_item_id, InventoryItem.company_id == company_id)
        )
        if iq.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="inventory_item not found in tenant")
    if tool_id:
        tq = await db.execute(select(Tool).where(Tool.id == tool_id, Tool.company_id == company_id))
        if tq.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="tool not found in tenant")


@router.post("/tasks/{task_id}/resources", response_model=PmCoordProjectDetailOut)
async def create_task_resource(
    task_id: str,
    body: PmCoordResourceCreate,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    t = await _get_task_for_company(db, cid, task_id)
    project_id = str(t.project_id)
    await _validate_inventory_tool_company(db, cid, body.inventory_item_id, body.tool_id)
    kind = body.resource_kind
    if kind not in (e.value for e in PmCoordResourceKind):
        kind = PmCoordResourceKind.material.value
    rec = PmCoordTaskResource(
        id=str(uuid4()),
        task_id=task_id,
        resource_kind=kind,
        label=body.label.strip(),
        notes=body.notes,
        inventory_item_id=body.inventory_item_id,
        tool_id=body.tool_id,
        created_at=_now(),
    )
    db.add(rec)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.patch("/task-resources/{resource_id}", response_model=PmCoordProjectDetailOut)
async def patch_task_resource(
    resource_id: str,
    body: PmCoordResourcePatch,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    cid = str(user.company_id)
    q = await db.execute(select(PmCoordTaskResource).where(PmCoordTaskResource.id == resource_id))
    rec = q.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Resource row not found")
    t = await _get_task_for_company(db, cid, str(rec.task_id))
    project_id = str(t.project_id)

    data = body.model_dump(exclude_unset=True)
    if "inventory_item_id" in data or "tool_id" in data:
        merged_inv = data["inventory_item_id"] if "inventory_item_id" in data else rec.inventory_item_id
        merged_tool = data["tool_id"] if "tool_id" in data else rec.tool_id
        await _validate_inventory_tool_company(db, cid, merged_inv, merged_tool)
    for k, v in data.items():
        setattr(rec, k, v)
    proj = await _get_project_for_company(db, cid, project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)


@router.delete("/task-resources/{resource_id}", response_model=PmCoordProjectDetailOut)
async def delete_task_resource(
    resource_id: str,
    user: Annotated[User, Depends(require_pm_features_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PmCoordProjectDetailOut:
    q = await db.execute(select(PmCoordTaskResource).where(PmCoordTaskResource.id == resource_id))
    rec = q.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Resource row not found")
    t = await _get_task_for_company(db, str(user.company_id), str(rec.task_id))
    project_id = str(t.project_id)
    await db.delete(rec)
    proj = await _get_project_for_company(db, str(user.company_id), project_id)
    proj.updated_at = _now()
    await db.commit()
    return await get_project(project_id, user, db)
