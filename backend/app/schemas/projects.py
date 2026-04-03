"""Pydantic schemas for tenant projects and tasks."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: date
    status: str = Field(default="active", description="active | completed | on_hold")


class ProjectPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    company_id: str
    name: str
    description: Optional[str]
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    assigned_user_id: Optional[str] = None
    priority: str = Field(default="medium")
    status: str = Field(default="todo")
    due_date: Optional[date] = None


class TaskPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    assigned_user_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None


class TaskBlockingMini(BaseModel):
    id: str
    title: str
    status: str


class TaskOut(BaseModel):
    id: str
    company_id: str
    project_id: str
    title: str
    description: Optional[str]
    assigned_user_id: Optional[str]
    priority: str
    status: str
    due_date: Optional[date]
    calendar_shift_id: Optional[str] = None
    calendar_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_blocked: bool = False
    blocking_tasks: list[TaskBlockingMini] = Field(default_factory=list)
    depends_on_task_ids: list[str] = Field(default_factory=list)


class ProjectDetailOut(ProjectOut):
    tasks: list[TaskOut] = []


def task_orm_to_out(
    t: Any,
    *,
    is_blocked: bool = False,
    blocking_tasks: Optional[list[TaskBlockingMini]] = None,
    depends_on_task_ids: Optional[list[str]] = None,
) -> TaskOut:
    pr = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
    st = t.status.value if hasattr(t.status, "value") else str(t.status)
    sid = str(t.calendar_shift_id) if t.calendar_shift_id else None
    return TaskOut(
        id=str(t.id),
        company_id=str(t.company_id),
        project_id=str(t.project_id),
        title=t.title,
        description=t.description,
        assigned_user_id=str(t.assigned_user_id) if t.assigned_user_id else None,
        priority=pr,
        status=st,
        due_date=t.due_date,
        calendar_shift_id=sid,
        calendar_event_id=sid,
        created_at=t.created_at,
        updated_at=t.updated_at,
        is_blocked=is_blocked,
        blocking_tasks=list(blocking_tasks or []),
        depends_on_task_ids=list(depends_on_task_ids or []),
    )


class TaskDependencyCreate(BaseModel):
    depends_on_task_id: str


class TaskDependencyOut(BaseModel):
    id: str
    task_id: str
    depends_on_task_id: str
    depends_on_title: str = ""


class AutomationRuleCreate(BaseModel):
    trigger_type: str = Field(..., description="task_status_changed | task_completed | task_overdue")
    condition_json: dict[str, Any] = Field(default_factory=dict)
    action_json: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class AutomationRulePatch(BaseModel):
    trigger_type: Optional[str] = None
    condition_json: Optional[dict[str, Any]] = None
    action_json: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class AutomationRuleOut(BaseModel):
    id: str
    project_id: str
    trigger_type: str
    condition_json: dict[str, Any]
    action_json: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProjectOutWithProgress(ProjectOut):
    """List row: task counts + progress percent (completed / total)."""

    task_total: int = 0
    task_completed: int = 0
    progress_pct: int = 0
    assignee_user_ids: list[str] = Field(default_factory=list)
