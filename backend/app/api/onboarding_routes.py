"""GET/PATCH current user's onboarding checklist — `/api/v1/onboarding`."""

from __future__ import annotations

import copy
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.models.domain import Company, User
from app.schemas.onboarding import OnboardingPatchIn, OnboardingStateOut, OnboardingStepOut
from app.services.onboarding_demo_seed import ensure_demo_monitoring_data
from app.services.onboarding_service import (
    ONBOARDING_STEP_KEYS,
    _normalize_steps,
    build_onboarding_state_out,
    is_manager_onboarding_user,
    recompute_onboarding_completed,
    sync_user_onboarding_from_reality,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _state_to_out(raw: dict) -> OnboardingStateOut:
    return OnboardingStateOut(
        onboarding_enabled=raw["onboarding_enabled"],
        onboarding_completed=raw["onboarding_completed"],
        steps=[OnboardingStepOut(**s) for s in raw["steps"]],
        completed_count=raw["completed_count"],
        total_count=raw["total_count"],
        flow=raw["flow"],
    )


@router.get("", response_model=OnboardingStateOut)
async def get_onboarding(
    db: Db,
    user: Annotated[User, Depends(get_current_company_user)],
) -> OnboardingStateOut:
    await sync_user_onboarding_from_reality(db, user)
    await db.commit()
    await db.refresh(user)
    raw = build_onboarding_state_out(user)
    return _state_to_out(raw)


@router.post("/demo-data", response_model=OnboardingStateOut)
async def post_onboarding_demo_data(
    db: Db,
    user: Annotated[User, Depends(get_current_company_user)],
) -> OnboardingStateOut:
    if not is_manager_onboarding_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="demo_onboarding_requires_manager",
        )
    cid = str(user.company_id)
    c = await db.get(Company, cid)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="company_not_found")
    c.onboarding_demo_sensors = True
    await ensure_demo_monitoring_data(db, cid)
    await sync_user_onboarding_from_reality(db, user)
    await db.commit()
    await db.refresh(user)
    return _state_to_out(build_onboarding_state_out(user))


@router.patch("", response_model=OnboardingStateOut)
async def patch_onboarding(
    body: OnboardingPatchIn,
    db: Db,
    user: Annotated[User, Depends(get_current_company_user)],
) -> OnboardingStateOut:
    if body.onboarding_enabled is not None:
        user.onboarding_enabled = body.onboarding_enabled

    if body.onboarding_seen is not None:
        user.onboarding_seen = bool(body.onboarding_seen)

    if body.step is not None:
        if body.step not in ONBOARDING_STEP_KEYS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_step")
        want = True if body.completed is None else bool(body.completed)
        steps = _normalize_steps(user.onboarding_steps)
        for s in steps:
            if s["key"] == body.step:
                s["completed"] = want
                break
        user.onboarding_steps = copy.deepcopy(steps)
        recompute_onboarding_completed(user, steps)
    elif body.onboarding_enabled is True:
        recompute_onboarding_completed(user)

    await db.commit()
    await db.refresh(user)
    raw = build_onboarding_state_out(user)
    return _state_to_out(raw)
