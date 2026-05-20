"""Tenant planning ideas intake API."""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_tenant_user
from app.models.domain import User
from app.models.pulse_models import PlanningIdeaApproval
from app.schemas.planning_idea_approvals import (
    PlanningIdeaApprovalOut,
    PlanningIdeaApprovalRequestIn,
    PlanningIdeaApprovalRequestOut,
    PlanningIdeaReviewerOut,
    PlanningIdeaStatsOut,
)
from app.schemas.planning_ideas import (
    PlanningIdeaConvertIn,
    PlanningIdeaConvertOut,
    PlanningIdeaCreateIn,
    PlanningIdeaOut,
    PlanningIdeaPatchIn,
)
from app.modules.pulse import project_service as proj_svc
from app.services import planning_idea_approvals_service as approval_svc
from app.services import planning_ideas_service as svc

router = APIRouter(prefix="/planning-ideas", tags=["planning-ideas"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]


def _out(row) -> PlanningIdeaOut:
    return PlanningIdeaOut.model_validate(svc._idea_to_dict(row))


@router.get("/stats", response_model=PlanningIdeaStatsOut)
async def planning_ideas_stats(db: Db, cid: CompanyId) -> PlanningIdeaStatsOut:
    return PlanningIdeaStatsOut.model_validate(await approval_svc.compute_stats(db, cid))


@router.get("/reviewers", response_model=list[PlanningIdeaReviewerOut])
async def planning_idea_reviewers(db: Db, cid: CompanyId) -> list[PlanningIdeaReviewerOut]:
    rows = await approval_svc.list_reviewers(db, cid)
    return [PlanningIdeaReviewerOut.model_validate(r) for r in rows]


@router.get("", response_model=list[PlanningIdeaOut])
async def list_planning_ideas(
    db: Db,
    cid: CompanyId,
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
) -> list[PlanningIdeaOut]:
    rows = await svc.list_ideas(db, cid, status=status, q=q)
    return [_out(r) for r in rows]


@router.post("", response_model=PlanningIdeaOut, status_code=status.HTTP_201_CREATED)
async def create_planning_idea(
    db: Db,
    cid: CompanyId,
    actor: Actor,
    body: PlanningIdeaCreateIn,
) -> PlanningIdeaOut:
    row = await svc.create_idea(
        db,
        cid,
        str(actor.id),
        title=body.title,
        description=body.description,
        location=body.location,
        category=body.category,
        estimated_cost=body.estimated_cost,
        priority=body.priority,
        status=body.status,
    )
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.get("/{idea_id}", response_model=PlanningIdeaOut)
async def get_planning_idea(db: Db, cid: CompanyId, idea_id: str) -> PlanningIdeaOut:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return _out(row)


@router.patch("/{idea_id}", response_model=PlanningIdeaOut)
async def patch_planning_idea(
    db: Db,
    cid: CompanyId,
    idea_id: str,
    body: PlanningIdeaPatchIn,
) -> PlanningIdeaOut:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.status == "converted":
        raise HTTPException(status_code=400, detail="Converted ideas cannot be edited")
    data = body.model_dump(exclude_unset=True)
    clear_cost = "estimated_cost" in data and data["estimated_cost"] is None
    try:
        row = await svc.patch_idea(
            db,
            row,
            title=data.get("title"),
            description=data.get("description"),
            location=data.get("location"),
            category=data.get("category"),
            estimated_cost=data.get("estimated_cost"),
            priority=data.get("priority"),
            status=data.get("status"),
            clear_estimated_cost=clear_cost,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_planning_idea(db: Db, cid: CompanyId, idea_id: str) -> None:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    await svc.delete_idea(db, row)
    await db.commit()


@router.post("/{idea_id}/request-approval", response_model=PlanningIdeaApprovalRequestOut, status_code=status.HTTP_201_CREATED)
async def request_planning_idea_approval(
    db: Db,
    cid: CompanyId,
    actor: Actor,
    idea_id: str,
    body: PlanningIdeaApprovalRequestIn,
) -> PlanningIdeaApprovalRequestOut:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        approval, email_sent, review_url = await approval_svc.request_approval(
            db,
            cid,
            str(actor.id),
            row,
            requested_to_user_id=body.requested_to_user_id.strip(),
            comments=body.comments,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(row)
    return PlanningIdeaApprovalRequestOut(
        approval_id=str(approval.id),
        idea_id=str(row.id),
        status=row.status,
        email_sent=email_sent,
        review_url=review_url if not email_sent else None,
    )


@router.get("/{idea_id}/approvals", response_model=list[PlanningIdeaApprovalOut])
async def list_planning_idea_approvals(db: Db, cid: CompanyId, idea_id: str) -> list[PlanningIdeaApprovalOut]:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    rq = await db.execute(
        select(PlanningIdeaApproval)
        .where(PlanningIdeaApproval.planning_idea_id == idea_id)
        .order_by(PlanningIdeaApproval.requested_at.desc())
    )
    return [PlanningIdeaApprovalOut.model_validate(approval_svc.approval_out(a)) for a in rq.scalars().all()]


@router.post("/{idea_id}/convert", response_model=PlanningIdeaConvertOut, status_code=status.HTTP_201_CREATED)
async def convert_planning_idea(
    db: Db,
    cid: CompanyId,
    actor: Actor,
    idea_id: str,
    body: PlanningIdeaConvertIn,
) -> PlanningIdeaConvertOut:
    row = await svc.get_idea(db, cid, idea_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    end = body.target_end_date
    if end is None:
        end = body.target_start_date + timedelta(days=90)
    if end < body.target_start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    owner = (body.owner_user_id or "").strip() or None
    if owner and not await proj_svc.user_in_company(db, cid, owner):
        raise HTTPException(status_code=400, detail="Owner not in organization")
    try:
        idea, project = await svc.convert_idea_to_project(
            db,
            cid,
            actor,
            row,
            owner_user_id=owner,
            department_slug=body.department_slug,
            target_start_date=body.target_start_date,
            target_end_date=end,
            template_id=body.template_id,
            project_status=body.project_status,
        )
    except ValueError as e:
        msg = str(e)
        code = 409 if "already converted" in msg else 400
        if "must be approved" in msg:
            code = 400
        raise HTTPException(status_code=code, detail=msg) from e
    await db.commit()
    await db.refresh(idea)
    return PlanningIdeaConvertOut(
        idea=_out(idea),
        project_id=str(project.id),
        project_name=project.name,
    )
