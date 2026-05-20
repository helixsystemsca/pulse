"""Planning idea approval workflow — API schemas."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ApprovalDecisionLiteral = Literal["approve", "reject"]
ApprovalStatusLiteral = Literal["pending", "approved", "rejected"]


class PlanningIdeaReviewerOut(BaseModel):
    user_id: str
    full_name: str
    email: str
    roles: list[str]


class PlanningIdeaApprovalRequestIn(BaseModel):
    requested_to_user_id: str = Field(..., min_length=1)
    comments: Optional[str] = Field(None, max_length=4000)


class PlanningIdeaApprovalRequestOut(BaseModel):
    approval_id: str
    idea_id: str
    status: str
    email_sent: bool
    review_url: Optional[str] = None


class PlanningIdeaApprovalOut(BaseModel):
    id: str
    planning_idea_id: str
    requested_by_user_id: Optional[str] = None
    requested_to_user_id: str
    status: str
    request_comments: Optional[str] = None
    reviewer_comments: Optional[str] = None
    requested_at: datetime
    responded_at: Optional[datetime] = None
    email_sent_at: Optional[datetime] = None


class PlanningIdeaStatsOut(BaseModel):
    ideas_submitted: int
    awaiting_approval: int
    approved: int
    converted_to_projects: int
    estimated_pipeline_value: Optional[Decimal] = None


class PublicPlanningApprovalIdeaOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    priority: str
    status: str
    request_comments: Optional[str] = None
    requester_name: str
    requester_email: Optional[str] = None
    company_name: str
    approval_status: str
    already_responded: bool


class PublicPlanningApprovalRespondIn(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    decision: ApprovalDecisionLiteral
    reviewer_comments: Optional[str] = Field(None, max_length=4000)

    @field_validator("decision")
    @classmethod
    def _decision(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("invalid decision")
        return v


class PublicPlanningApprovalRespondOut(BaseModel):
    ok: bool
    decision: str
    idea_status: str
    message: str
