"""GET/PATCH current user's onboarding checklist — `/api/v1/onboarding`."""

from __future__ import annotations

import copy
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User, UserRole
from app.schemas.onboarding import OnboardingPatchIn, OnboardingStateOut, OnboardingStepOut
from app.services.onboarding_service import (
    ONBOARDING_STEP_KEYS,
    _all_complete,
    _normalize_steps,
    build_onboarding_state_out,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _require_tenant_user(user: User) -> None:
    if user.role == UserRole.system_admin or user.is_system_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="onboarding_not_available")
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="onboarding_not_available")


@router.get("", response_model=OnboardingStateOut)
async def get_onboarding(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
) -> OnboardingStateOut:
    _require_tenant_user(user)
    raw = build_onboarding_state_out(user)
    return OnboardingStateOut(
        onboarding_enabled=raw["onboarding_enabled"],
        onboarding_completed=raw["onboarding_completed"],
        steps=[OnboardingStepOut(**s) for s in raw["steps"]],
        completed_count=raw["completed_count"],
        total_count=raw["total_count"],
    )


@router.patch("", response_model=OnboardingStateOut)
async def patch_onboarding(
    body: OnboardingPatchIn,
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
) -> OnboardingStateOut:
    _require_tenant_user(user)

    if body.onboarding_enabled is not None:
        user.onboarding_enabled = body.onboarding_enabled

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
        if _all_complete(steps):
            user.onboarding_completed = True
        elif not want:
            user.onboarding_completed = False

    await db.commit()
    await db.refresh(user)
    raw = build_onboarding_state_out(user)
    return OnboardingStateOut(
        onboarding_enabled=raw["onboarding_enabled"],
        onboarding_completed=raw["onboarding_completed"],
        steps=[OnboardingStepOut(**s) for s in raw["steps"]],
        completed_count=raw["completed_count"],
        total_count=raw["total_count"],
    )
