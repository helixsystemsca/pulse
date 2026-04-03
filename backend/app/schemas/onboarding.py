from typing import Literal, Optional

from pydantic import BaseModel, Field

OnboardingStepKey = Literal[
    "create_zone",
    "add_device",
    "create_work_order",
    "view_operations",
]


class OnboardingStepOut(BaseModel):
    key: str
    label: str
    completed: bool


class OnboardingStateOut(BaseModel):
    onboarding_enabled: bool
    onboarding_completed: bool
    steps: list[OnboardingStepOut]
    completed_count: int
    total_count: int


class OnboardingPatchIn(BaseModel):
    """Mark a step complete and/or disable onboarding prompts entirely."""

    step: Optional[OnboardingStepKey] = None
    completed: Optional[bool] = None
    onboarding_enabled: Optional[bool] = None
