"""Roadmap API schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class RoadmapAttachmentIn(BaseModel):
    name: str = Field(..., max_length=255)
    url: str = Field(..., max_length=2048)


class RoadmapMilestoneOut(BaseModel):
    id: str
    company_id: str
    roadmap_project_id: Optional[str] = None
    title: str
    milestone_date: date
    completed: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class RoadmapMilestoneCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    milestone_date: date
    roadmap_project_id: Optional[str] = None
    completed: bool = False
    sort_order: int = 0


class RoadmapMilestonePatchIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    milestone_date: Optional[date] = None
    roadmap_project_id: Optional[str] = None
    completed: Optional[bool] = None
    sort_order: Optional[int] = None


class RoadmapProjectOut(BaseModel):
    id: str
    company_id: str
    title: str
    description: Optional[str] = None
    category: str
    owner: Optional[str] = None
    owner_user_id: Optional[str] = None
    color: Optional[str] = None
    start_date: date
    end_date: date
    progress: int
    priority: str
    status: str
    budget: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    sort_order: int
    archived: bool
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    milestones: list[RoadmapMilestoneOut] = Field(default_factory=list)


class RoadmapProjectListOut(BaseModel):
    id: str
    title: str
    category: str
    owner: Optional[str] = None
    color: Optional[str] = None
    start_date: date
    end_date: date
    progress: int
    priority: str
    status: str
    sort_order: int
    archived: bool
    dependencies: list[str] = Field(default_factory=list)


class RoadmapProjectCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    category: str = "projects"
    owner: Optional[str] = Field(None, max_length=255)
    owner_user_id: Optional[str] = None
    color: Optional[str] = Field(None, max_length=32)
    start_date: date
    end_date: date
    progress: int = Field(0, ge=0, le=100)
    priority: str = "medium"
    status: str = "planned"
    budget: Optional[float] = Field(None, ge=0)
    tags: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    attachments: list[RoadmapAttachmentIn] = Field(default_factory=list)
    sort_order: int = 0

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, end_date: date, info) -> date:
        start = info.data.get("start_date")
        if start and end_date < start:
            raise ValueError("end_date must be on or after start_date")
        return end_date


class RoadmapProjectPatchIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    category: Optional[str] = None
    owner: Optional[str] = Field(None, max_length=255)
    owner_user_id: Optional[str] = None
    color: Optional[str] = Field(None, max_length=32)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    priority: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = Field(None, ge=0)
    tags: Optional[list[str]] = None
    dependencies: Optional[list[str]] = None
    notes: Optional[str] = None
    attachments: Optional[list[RoadmapAttachmentIn]] = None
    sort_order: Optional[int] = None
    archived: Optional[bool] = None


class RoadmapStatsOut(BaseModel):
    total: int
    completed: int
    in_progress: int
    behind: int
    upcoming_milestones: int


class RoadmapTaskMilestoneOut(BaseModel):
    """Task due date on a pulse project — roadmap milestone marker."""

    id: str
    project_id: str
    title: str
    milestone_date: date
    completed: bool
