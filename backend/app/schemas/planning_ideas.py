"""Planning ideas intake — API schemas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

PlanningIdeaStatusLiteral = Literal[
    "idea",
    "awaiting_review",
    "approved",
    "deferred",
    "rejected",
    "converted",
]
PlanningIdeaPriorityLiteral = Literal["low", "medium", "high", "critical"]

_STATUSES = frozenset({"idea", "awaiting_review", "approved", "deferred", "rejected", "converted"})
_PRIORITIES = frozenset({"low", "medium", "high", "critical"})


class PlanningIdeaOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    priority: str
    status: str
    created_by_user_id: Optional[str] = None
    linked_project_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    converted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PlanningIdeaCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=128)
    estimated_cost: Optional[Decimal] = Field(None, ge=0)
    priority: PlanningIdeaPriorityLiteral = "medium"
    status: PlanningIdeaStatusLiteral = "idea"

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in _STATUSES:
            raise ValueError("invalid status")
        if v == "converted":
            raise ValueError("cannot create with status converted")
        return v

    @field_validator("priority")
    @classmethod
    def _priority(cls, v: str) -> str:
        if v not in _PRIORITIES:
            raise ValueError("invalid priority")
        return v


class PlanningIdeaPatchIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=128)
    estimated_cost: Optional[Decimal] = Field(None, ge=0)
    priority: Optional[PlanningIdeaPriorityLiteral] = None
    status: Optional[PlanningIdeaStatusLiteral] = None

    @field_validator("status")
    @classmethod
    def _status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in _STATUSES:
            raise ValueError("invalid status")
        return v

    @field_validator("priority")
    @classmethod
    def _priority(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in _PRIORITIES:
            raise ValueError("invalid priority")
        return v


class PlanningIdeaConvertIn(BaseModel):
    owner_user_id: Optional[str] = None
    department_slug: Optional[str] = Field(None, max_length=32)
    target_start_date: date
    target_end_date: Optional[date] = None
    template_id: Optional[str] = None
    project_status: str = Field(default="future", description="active | future | on_hold")


class PlanningIdeaConvertOut(BaseModel):
    idea: PlanningIdeaOut
    project_id: str
    project_name: str
