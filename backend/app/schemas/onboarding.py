from typing import Literal, Optional

from pydantic import BaseModel, Field

OnboardingFlowOut = Literal["manager", "worker"]


class OnboardingStepOut(BaseModel):
    key: str
    label: str
    description: str = ""
    completed: bool
    optional: bool = False
    href: str = Field(default="/overview", description="Tenant app path for this step")


class OnboardingStateOut(BaseModel):
    onboarding_enabled: bool
    #: True when the company_admin org checklist is complete (always false for non-admins).
    onboarding_completed: bool
    org_onboarding_completed: bool
    user_onboarding_tour_completed: bool
    onboarding_role: str
    checklist_progress: Optional[dict[str, bool]] = None
    steps: list[OnboardingStepOut]
    completed_count: int
    total_count: int
    flow: OnboardingFlowOut


class OnboardingPatchIn(BaseModel):
    """Mark a step complete and/or disable onboarding prompts entirely."""

    step: Optional[str] = None
    completed: Optional[bool] = None
    onboarding_enabled: Optional[bool] = None
    onboarding_seen: Optional[bool] = None
    user_onboarding_tour_completed: Optional[bool] = None
