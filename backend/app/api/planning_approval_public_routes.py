"""Public planning idea approval review (tokenized, no session required)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import get_db
from app.core.config import get_settings
from app.limiter import limiter
from app.schemas.planning_idea_approvals import (
    PublicPlanningApprovalIdeaOut,
    PublicPlanningApprovalRespondIn,
    PublicPlanningApprovalRespondOut,
)
from app.services import planning_idea_approvals_service as approval_svc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from fastapi import Depends

router = APIRouter(tags=["public-planning-approval"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/planning-approval", response_model=PublicPlanningApprovalIdeaOut)
@limiter.limit("30/minute")
async def get_planning_approval_review(
    request: Request,
    db: Db,
    token: str = Query(..., min_length=16, max_length=256),
) -> PublicPlanningApprovalIdeaOut:
    try:
        payload = await approval_svc.get_public_review_payload(db, token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PublicPlanningApprovalIdeaOut.model_validate(payload)


@router.post("/planning-approval/respond", response_model=PublicPlanningApprovalRespondOut)
@limiter.limit("20/minute")
async def respond_planning_approval(
    request: Request,
    db: Db,
    body: PublicPlanningApprovalRespondIn,
) -> PublicPlanningApprovalRespondOut:
    try:
        idea, _approval, message = await approval_svc.respond_via_token(
            db,
            body.token,
            decision=body.decision,
            reviewer_comments=body.reviewer_comments,
        )
    except ValueError as e:
        msg = str(e)
        code = 409 if "already completed" in msg else 404
        raise HTTPException(status_code=code, detail=msg) from e
    await db.commit()
    _ = get_settings()  # ensure settings load in worker
    return PublicPlanningApprovalRespondOut(
        ok=True,
        decision=body.decision,
        idea_status=idea.status,
        message=message,
    )
