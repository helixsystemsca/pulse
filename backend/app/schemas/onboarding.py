from typing import Literal, Optional

from pydantic import BaseModel

OnboardingStepKey = Literal[
    "create_zone",
    "add_device",
    "create_work_order",
    "view_operations",
    "complete_work_order",
    "view_schedule",
    "log_issue",
]

OnboardingFlowOut = Literal["manager", "worker"]


class OnboardingStepOut(BaseModel):
    key: str
    label: str
    description: str = ""
    completed: bool


class OnboardingStateOut(BaseModel):
    onboarding_enabled: bool
    onboarding_completed: bool
    steps: list[OnboardingStepOut]
    completed_count: int
    total_count: int
    flow: OnboardingFlowOut


class OnboardingPatchIn(BaseModel):
    """Mark a step complete and/or disable onboarding prompts entirely."""

    step: Optional[OnboardingStepKey] = None
    completed: Optional[bool] = None
    onboarding_enabled: Optional[bool] = None
