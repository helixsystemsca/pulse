"""Per-user onboarding tour completion (stored in ``users.ui_preferences``)."""

from __future__ import annotations

from pydantic import BaseModel, Field

DASHBOARD_OVERVIEW_TOUR_ID = "dashboard-overview"
DASHBOARD_WORKER_TOUR_ID = "dashboard-worker"


class OnboardingToursOut(BaseModel):
    completed: dict[str, bool] = Field(default_factory=dict)


class OnboardingTourPatchIn(BaseModel):
    tour_id: str = Field(..., min_length=1, max_length=64)
    completed: bool = True


class OnboardingTourResetIn(BaseModel):
    tour_id: str = Field(default=DASHBOARD_OVERVIEW_TOUR_ID, min_length=1, max_length=64)


class OnboardingTourResetOut(BaseModel):
    tour_id: str
    completed: dict[str, bool]
