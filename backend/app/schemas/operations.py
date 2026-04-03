"""Supervisor / operations accountability API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.projects import TaskHealthItem


class MissedProximityEventOut(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    location_tag_id: str
    equipment_label: str = ""
    tasks_present: list[str] = Field(default_factory=list)
    task_titles: list[str] = Field(default_factory=list)
    detected_at: datetime
    is_missed: bool
    missed_at: Optional[datetime] = None


class OperationsAccountabilityOut(BaseModel):
    missed_proximity: list[MissedProximityEventOut] = Field(default_factory=list)
    overdue_tasks: list[TaskHealthItem] = Field(default_factory=list)
    stale_tasks: list[TaskHealthItem] = Field(default_factory=list)
    blocked_tasks: list[TaskHealthItem] = Field(default_factory=list)
    """Union of overdue, stale, blocked (one row per task)."""
    at_risk_tasks: list[TaskHealthItem] = Field(default_factory=list)


class OperationsInsightsSummary(BaseModel):
    total_missed_events: int = 0
    total_overdue_tasks: int = 0
    total_stale_tasks: int = 0
    avg_responsiveness_score: float = 0.0


class UserPerformanceInsight(BaseModel):
    user_id: str
    name: str
    responsiveness_score: int
    reliability_score: int
    tasks_completed: int
    missed_proximity_events: int
    tasks_overdue: int = 0
    tasks_stale: int = 0
    avg_response_time_seconds: Optional[float] = None
    completion_rate: float = 0.0


class LocationBottleneckInsight(BaseModel):
    location_tag_id: str
    equipment_label: str = ""
    missed_events_count: int = 0
    overdue_tasks_count: int = 0


class ProjectBottleneckInsight(BaseModel):
    project_id: str
    project_name: str = ""
    overdue_tasks: int = 0
    blocked_tasks: int = 0


class OperationsInsightsOut(BaseModel):
    time_window: str
    summary: OperationsInsightsSummary
    user_performance: list[UserPerformanceInsight] = Field(default_factory=list)
    location_bottlenecks: list[LocationBottleneckInsight] = Field(default_factory=list)
    project_bottlenecks: list[ProjectBottleneckInsight] = Field(default_factory=list)
