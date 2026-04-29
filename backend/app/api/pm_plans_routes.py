"""Soft-start PM plans: quick recurring maintenance -> auto-generated Work Requests."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_manager_or_above
from app.models.domain import User
from app.schemas.pm_plan import PmPlanCreateIn, PmPlanCreateResultOut, PmPlanOut
from app.services.pm_plan_service import create_pm_plan_and_first_work_request

router = APIRouter(prefix="/pm-plans", tags=["pm-plans"])

Db = Annotated[AsyncSession, Depends(get_db)]
MutatorUser = Annotated[User, Depends(require_manager_or_above)]


@router.post("", response_model=PmPlanCreateResultOut, status_code=status.HTTP_201_CREATED)
async def create_pm_plan(db: Db, user: MutatorUser, body: PmPlanCreateIn) -> PmPlanCreateResultOut:
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company context required")
    cid = str(user.company_id)
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    start_date = body.start_date or datetime.now(timezone.utc).date()

    try:
        plan, wr = await create_pm_plan_and_first_work_request(
            db,
            company_id=cid,
            title=title,
            description=body.description,
            frequency=body.frequency,
            start_date=start_date,
            due_time_offset_days=body.due_time_offset_days,
            assigned_user_id=body.assigned_to,
            custom_interval_days=body.custom_interval_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    await db.commit()
    await db.refresh(plan)
    await db.refresh(wr)
    return PmPlanCreateResultOut(plan=PmPlanOut.model_validate(plan), generated_work_request_id=str(wr.id))

