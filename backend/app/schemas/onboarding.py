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


class ModuleChecklistItemOut(BaseModel):
    key: str
    label: str
    completed: bool
    href: str = "/overview"


class ModuleChecklistOut(BaseModel):
    module: str
    title: str
    completed_count: int
    total_count: int
    items: list[ModuleChecklistItemOut]


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
    tier1_modules: list[ModuleChecklistOut] = []
    tier1_completed_count: int = 0
    tier1_total_count: int = 0
    tier2_enabled: bool = False
    tier2_eligible: bool = False


class OnboardingPatchIn(BaseModel):
    """Mark a step complete and/or disable onboarding prompts entirely."""

    step: Optional[str] = None
    completed: Optional[bool] = None
    onboarding_enabled: Optional[bool] = None
    onboarding_seen: Optional[bool] = None
    user_onboarding_tour_completed: Optional[bool] = None
    tier2_enabled: Optional[bool] = None
