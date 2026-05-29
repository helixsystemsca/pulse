"""Per-user onboarding tour state (synced across browsers via ``users.ui_preferences``)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.onboarding_preferences import (
    DASHBOARD_OVERVIEW_TOUR_ID,
    OnboardingTourPatchIn,
    OnboardingToursOut,
)

router = APIRouter(prefix="/profile/onboarding-tours", tags=["profile"])


def _ui_prefs(user: User) -> dict[str, Any]:
    raw = getattr(user, "ui_preferences", None)
    return dict(raw) if isinstance(raw, dict) else {}


def _onboarding_tours_block(prefs: dict[str, Any]) -> dict[str, Any]:
    block = prefs.get("onboardingTours")
    return dict(block) if isinstance(block, dict) else {}


def _completed_map(block: dict[str, Any]) -> dict[str, bool]:
    raw = block.get("completed")
    if not isinstance(raw, dict):
        return {}
    out: dict[str, bool] = {}
    for k, v in raw.items():
        if isinstance(k, str) and k.strip():
            out[k.strip()] = bool(v)
    return out


def read_onboarding_tours_completed(user: User) -> dict[str, bool]:
    return _completed_map(_onboarding_tours_block(_ui_prefs(user)))


def clear_onboarding_tour_completed(user: User, tour_id: str) -> dict[str, bool]:
    tid = (tour_id or "").strip() or DASHBOARD_OVERVIEW_TOUR_ID
    prefs = _ui_prefs(user)
    block = _onboarding_tours_block(prefs)
    completed = _completed_map(block)
    completed.pop(tid, None)
    block["completed"] = completed
    prefs["onboardingTours"] = block
    user.ui_preferences = prefs
    return completed


def set_onboarding_tour_completed(user: User, tour_id: str, *, completed: bool) -> dict[str, bool]:
    tid = (tour_id or "").strip()
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tour_id required")
    prefs = _ui_prefs(user)
    block = _onboarding_tours_block(prefs)
    done = _completed_map(block)
    if completed:
        done[tid] = True
    else:
        done.pop(tid, None)
    block["completed"] = done
    prefs["onboardingTours"] = block
    user.ui_preferences = prefs
    return done


@router.get("", response_model=OnboardingToursOut)
async def get_my_onboarding_tours(
    user: Annotated[User, Depends(get_current_user)],
) -> OnboardingToursOut:
    return OnboardingToursOut(completed=read_onboarding_tours_completed(user))


@router.patch("", response_model=OnboardingToursOut)
async def patch_my_onboarding_tour(
    body: OnboardingTourPatchIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OnboardingToursOut:
    completed = set_onboarding_tour_completed(user, body.tour_id, completed=body.completed)
    await db.commit()
    return OnboardingToursOut(completed=completed)
