"""Strategic roadmap API."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.schemas.roadmap import (
    RoadmapMilestoneCreateIn,
    RoadmapMilestoneOut,
    RoadmapMilestonePatchIn,
    RoadmapProjectCreateIn,
    RoadmapProjectListOut,
    RoadmapProjectOut,
    RoadmapProjectPatchIn,
    RoadmapStatsOut,
    RoadmapTaskMilestoneOut,
)
from app.services import roadmap_service as svc

router = APIRouter(prefix="/roadmap", tags=["roadmap"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[User, Depends(require_any_rbac("roadmap.view", "roadmap.manage", "projects.view"))]
Editor = Annotated[User, Depends(require_any_rbac("roadmap.manage"))]
ProjectsReader = Annotated[User, Depends(require_any_rbac("roadmap.view", "roadmap.manage", "projects.view"))]


@router.get("/task-milestones", response_model=list[RoadmapTaskMilestoneOut])
async def list_task_milestones(
    db: Db,
    cid: CompanyId,
    _: ProjectsReader,
    year: int = Query(..., ge=2000, le=2100),
) -> list[RoadmapTaskMilestoneOut]:
    rows = await svc.list_task_milestones_for_year(db, cid, year=year)
    return [RoadmapTaskMilestoneOut.model_validate(r) for r in rows]


@router.get("/stats", response_model=RoadmapStatsOut)
async def roadmap_stats(db: Db, cid: CompanyId, _: Reader) -> RoadmapStatsOut:
    return RoadmapStatsOut.model_validate(await svc.compute_stats(db, cid))


@router.get("/projects", response_model=list[RoadmapProjectListOut])
async def list_roadmap_projects(
    db: Db,
    cid: CompanyId,
    _: Reader,
    archived: Optional[bool] = Query(False),
    q: Optional[str] = Query(None, max_length=200),
    category: Optional[str] = Query(None, max_length=32),
    owner: Optional[str] = Query(None, max_length=255),
    status: Optional[str] = Query(None, max_length=32),
    priority: Optional[str] = Query(None, max_length=16),
    tag: Optional[str] = Query(None, max_length=64),
) -> list[RoadmapProjectListOut]:
    rows = await svc.list_projects(
        db,
        cid,
        archived=archived,
        q=q,
        category=category,
        owner=owner,
        status=status,
        priority=priority,
        tag=tag,
    )
    return [RoadmapProjectListOut.model_validate(svc._list_dict(r)) for r in rows]


@router.post("/projects", response_model=RoadmapProjectOut, status_code=status.HTTP_201_CREATED)
async def create_roadmap_project(
    db: Db,
    cid: CompanyId,
    actor: Editor,
    body: RoadmapProjectCreateIn,
) -> RoadmapProjectOut:
    try:
        row = await svc.create_project(db, cid, str(actor.id), data=body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    row = await svc.get_project(db, cid, str(row.id))
    return RoadmapProjectOut.model_validate(svc._project_dict(row))


@router.get("/projects/{project_id}", response_model=RoadmapProjectOut)
async def get_roadmap_project(db: Db, cid: CompanyId, _: Reader, project_id: str) -> RoadmapProjectOut:
    row = await svc.get_project(db, cid, project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return RoadmapProjectOut.model_validate(svc._project_dict(row))


@router.patch("/projects/{project_id}", response_model=RoadmapProjectOut)
async def patch_roadmap_project(
    db: Db,
    cid: CompanyId,
    _: Editor,
    project_id: str,
    body: RoadmapProjectPatchIn,
) -> RoadmapProjectOut:
    try:
        row = await svc.patch_project(db, cid, project_id, data=body.model_dump(exclude_unset=True))
    except LookupError:
        raise HTTPException(status_code=404, detail="Not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    row = await svc.get_project(db, cid, project_id)
    return RoadmapProjectOut.model_validate(svc._project_dict(row))


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roadmap_project(db: Db, cid: CompanyId, _: Editor, project_id: str) -> None:
    try:
        await svc.delete_project(db, cid, project_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Not found") from None
    await db.commit()


@router.get("/milestones", response_model=list[RoadmapMilestoneOut])
async def list_roadmap_milestones(
    db: Db,
    cid: CompanyId,
    _: Reader,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    include_completed: bool = Query(True),
) -> list[RoadmapMilestoneOut]:
    rows = await svc.list_milestones(db, cid, year=year, include_completed=include_completed)
    return [RoadmapMilestoneOut.model_validate(svc._milestone_dict(r)) for r in rows]


@router.post("/milestones", response_model=RoadmapMilestoneOut, status_code=status.HTTP_201_CREATED)
async def create_roadmap_milestone(
    db: Db,
    cid: CompanyId,
    _: Editor,
    body: RoadmapMilestoneCreateIn,
) -> RoadmapMilestoneOut:
    try:
        row = await svc.create_milestone(db, cid, data=body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(row)
    return RoadmapMilestoneOut.model_validate(svc._milestone_dict(row))


@router.patch("/milestones/{milestone_id}", response_model=RoadmapMilestoneOut)
async def patch_roadmap_milestone(
    db: Db,
    cid: CompanyId,
    _: Editor,
    milestone_id: str,
    body: RoadmapMilestonePatchIn,
) -> RoadmapMilestoneOut:
    try:
        row = await svc.patch_milestone(db, cid, milestone_id, data=body.model_dump(exclude_unset=True))
    except LookupError:
        raise HTTPException(status_code=404, detail="Not found") from None
    await db.commit()
    await db.refresh(row)
    return RoadmapMilestoneOut.model_validate(svc._milestone_dict(row))


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roadmap_milestone(db: Db, cid: CompanyId, _: Editor, milestone_id: str) -> None:
    try:
        await svc.delete_milestone(db, cid, milestone_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Not found") from None
    await db.commit()
