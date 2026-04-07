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
    onboarding_completed: bool
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
