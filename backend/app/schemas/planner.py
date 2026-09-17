"""Pydantic schemas for the Daily Operations Planner."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PlannerCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    color: str
    sort_order: int
    active: bool


class PlannerCategoryPatchIn(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None


class PlannerSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    work_start: time
    work_end: time
    category_targets: dict[str, Any] = Field(default_factory=dict)
    scheduler_weights: dict[str, Any] = Field(default_factory=dict)
    adaptive_scheduling: bool = False
    timezone: str = "America/Vancouver"


class PlannerSettingsPatchIn(BaseModel):
    work_start: Optional[time] = None
    work_end: Optional[time] = None
    category_targets: Optional[dict[str, float]] = None
    scheduler_weights: Optional[dict[str, int]] = None
    adaptive_scheduling: Optional[bool] = None
    timezone: Optional[str] = None


class PlannerRoutineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category_id: str
    start_time: time
    end_time: time
    recurrence: str
    protected: bool
    flexible: bool
    min_minutes: Optional[int] = None
    max_minutes: Optional[int] = None
    priority: int
    active: bool
    sort_order: int


class PlannerRoutineIn(BaseModel):
    name: str
    category_id: str
    start_time: time
    end_time: time
    recurrence: str = "weekdays"
    protected: bool = False
    flexible: bool = True
    min_minutes: Optional[int] = None
    max_minutes: Optional[int] = None
    priority: int = 50
    active: bool = True
    sort_order: int = 0


class PlannerRoutinePatchIn(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    recurrence: Optional[str] = None
    protected: Optional[bool] = None
    flexible: Optional[bool] = None
    min_minutes: Optional[int] = None
    max_minutes: Optional[int] = None
    priority: Optional[int] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None


class PlannerTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str] = None
    category_id: str
    tags: list[Any] = Field(default_factory=list)
    priority: str
    priority_score: int
    estimated_minutes: int
    due_date: Optional[date] = None
    deadline: Optional[date] = None
    source_type: str
    source_id: Optional[str] = None
    project_id: Optional[str] = None
    asset_id: Optional[str] = None
    person_label: Optional[str] = None
    recurrence: Optional[str] = None
    notes: Optional[str] = None
    status: str
    delay_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    actual_minutes: Optional[int] = None
    created_at: datetime
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None


class PlannerTaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    category_slug: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    priority: str = "medium"
    priority_score: int = 0
    estimated_minutes: int = 30
    due_date: Optional[date] = None
    deadline: Optional[date] = None
    source_type: str = "manual"
    source_id: Optional[str] = None
    project_id: Optional[str] = None
    asset_id: Optional[str] = None
    person_label: Optional[str] = None
    recurrence: Optional[str] = None
    notes: Optional[str] = None


class PlannerTaskPatchIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[list[str]] = None
    priority: Optional[str] = None
    priority_score: Optional[int] = None
    estimated_minutes: Optional[int] = None
    due_date: Optional[date] = None
    deadline: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    project_id: Optional[str] = None
    asset_id: Optional[str] = None
    person_label: Optional[str] = None
    recurrence: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class PlannerBlockerIn(BaseModel):
    blocker_type: str
    description: Optional[str] = None
    responsible_party: Optional[str] = None


class PlannerHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    previous_date: Optional[date] = None
    previous_start: Optional[time] = None
    new_date: Optional[date] = None
    new_start: Optional[time] = None
    reason: str
    source: str
    notes: Optional[str] = None
    changed_at: datetime
    healthy: bool = False


class PlannerScheduleBlockOut(BaseModel):
    id: str
    date: date
    start_time: time
    end_time: time
    title: str
    block_type: str
    locked: bool
    generated_by_scheduler: bool
    status: str
    task_id: Optional[str] = None
    calendar_event_id: Optional[str] = None
    routine_block_id: Optional[str] = None
    category_id: Optional[str] = None
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = None
    source_type: Optional[str] = None
    delay_count: int = 0
    delay_reason: Optional[str] = None


class PlannerCalendarEventIn(BaseModel):
    title: str
    start_at: datetime
    end_at: datetime
    notes: Optional[str] = None


class PlannerCalendarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    title: str
    start_at: datetime
    end_at: datetime
    notes: Optional[str] = None


class PlannerPlaceIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Field cannot be named `date` — with from __future__ import annotations it shadows datetime.date.
    plan_date: Optional[date] = Field(default=None, alias="date")
    task_ids: Optional[list[str]] = None


class PlannerInterruptionIn(BaseModel):
    reason: str = "emergency"
    notes: Optional[str] = None
    category_id: Optional[str] = None
    create_work_request: bool = False
    duration_minutes: Optional[int] = None


class PlannerInterruptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reason: str
    notes: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    paused_task_id: Optional[str] = None
    create_work_request: bool = False
    work_request_id: Optional[str] = None
    work_request_warning: Optional[str] = None


class PlannerDeferIn(BaseModel):
    reason: str = "personal_manual"
    notes: Optional[str] = None


class PlannerMoveIn(BaseModel):
    start_time: time
    end_time: Optional[time] = None
    reason: str = "personal_manual"


class PlannerBlockCreateIn(BaseModel):
    date: Optional[date] = None
    start_time: time
    end_time: time
    title: str = "Open"
    category_id: Optional[str] = None
    block_type: str = "open"
    task_id: Optional[str] = None


class PlannerBlockPatchIn(BaseModel):
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    title: Optional[str] = None
    category_id: Optional[str] = None


class PlannerCloseoutIn(BaseModel):
    notes: Optional[str] = None


class PlannerDayOut(BaseModel):
    date: date
    day_label: str
    work_start: time
    work_end: time
    completion_pct: float
    now: Optional[PlannerScheduleBlockOut] = None
    next: Optional[PlannerScheduleBlockOut] = None
    at_risk: list[PlannerTaskOut] = Field(default_factory=list)
    timeline: list[PlannerScheduleBlockOut] = Field(default_factory=list)
    open_interruption: Optional[PlannerInterruptionOut] = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class PlannerPlaceOut(PlannerDayOut):
    """Day board plus placement feedback for Inbox → Place on today."""

    placed_count: int = 0
    unplaced_count: int = 0
    unplaced_titles: list[str] = Field(default_factory=list)
    placed_task_ids: list[str] = Field(default_factory=list)
    message: str = ""


class PlannerAnalyticsOut(BaseModel):
    range_label: str
    start: date
    end: date
    productivity: dict[str, Any] = Field(default_factory=dict)
    time_allocation: dict[str, Any] = Field(default_factory=dict)
    interruptions: dict[str, Any] = Field(default_factory=dict)
    delays: dict[str, Any] = Field(default_factory=dict)
    blockers: dict[str, Any] = Field(default_factory=dict)
    insights: list[str] = Field(default_factory=list)
    comparison: dict[str, Any] = Field(default_factory=dict)
