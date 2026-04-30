"""Pydantic schemas for tenant projects and tasks."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: date
    status: str = Field(default="active", description="active | future | completed | on_hold")
    owner_user_id: Optional[str] = Field(None, description="User id within the tenant")
    template_id: Optional[str] = Field(None, description="Optional project template id")
    category_id: Optional[str] = Field(None, description="Optional category id")


class ProjectPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    owner_user_id: Optional[str] = None
    category_id: Optional[str] = None
    goal: Optional[str] = None
    notes: Optional[str] = None
    success_definition: Optional[str] = None
    current_phase: Optional[str] = None
    summary: Optional[str] = None
    metrics: Optional[str] = None
    lessons_learned: Optional[str] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    created_at: datetime


class CategoryCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    color: Optional[str] = Field(None, max_length=64)


class ProjectOut(BaseModel):
    id: str
    company_id: str
    name: str
    description: Optional[str]
    owner_user_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[CategoryOut] = None
    start_date: date
    end_date: date
    goal: Optional[str] = None
    notes: Optional[str] = None
    success_definition: Optional[str] = None
    current_phase: Optional[str] = None
    summary: Optional[str] = None
    metrics: Optional[str] = None
    lessons_learned: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    health_status: str = "On Track"

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    assigned_user_id: Optional[str] = None
    priority: str = Field(default="medium")
    status: str = Field(default="todo")
    due_date: Optional[date] = None
    estimated_duration: Optional[str] = Field(None, max_length=64)
    skill_type: Optional[str] = Field(None, max_length=128)
    material_notes: Optional[str] = None
    phase_group: Optional[str] = Field(None, max_length=128)
    planned_start_at: Optional[datetime] = None
    planned_end_at: Optional[datetime] = None
    location_tag_id: Optional[str] = Field(None, max_length=128)
    sop_id: Optional[str] = Field(None, max_length=128)
    required_skill_names: list[str] = Field(default_factory=list)


class TaskPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    assigned_user_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    estimated_duration: Optional[str] = Field(None, max_length=64)
    skill_type: Optional[str] = Field(None, max_length=128)
    material_notes: Optional[str] = None
    phase_group: Optional[str] = Field(None, max_length=128)
    planned_start_at: Optional[datetime] = None
    planned_end_at: Optional[datetime] = None
    location_tag_id: Optional[str] = Field(None, max_length=128)
    sop_id: Optional[str] = Field(None, max_length=128)
    required_skill_names: Optional[list[str]] = None


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
    required_skill_names: list[str] = Field(default_factory=list)
    due_date: Optional[date]
    estimated_duration: Optional[str] = None
    skill_type: Optional[str] = None
    material_notes: Optional[str] = None
    phase_group: Optional[str] = None
    planned_start_at: Optional[datetime] = None
    planned_end_at: Optional[datetime] = None
    calendar_shift_id: Optional[str] = None
    calendar_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_blocked: bool = False
    is_ready: bool = False
    is_overdue: bool = False
    is_stale: bool = False
    location_tag_id: Optional[str] = None
    sop_id: Optional[str] = None
    blocking_tasks: list[TaskBlockingMini] = Field(default_factory=list)
    depends_on_task_ids: list[str] = Field(default_factory=list)


class ProjectDetailOut(ProjectOut):
    tasks: list[TaskOut] = []


class ProjectActivityOut(BaseModel):
    id: str
    project_id: str
    type: str
    title: Optional[str] = None
    description: str
    impact_level: Optional[str] = None
    related_task_id: Optional[str] = None
    created_at: datetime


class ProjectActivityCreateNoteIn(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: str = Field(..., min_length=1, max_length=4000)


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
    loc = getattr(t, "location_tag_id", None)
    sop = getattr(t, "sop_id", None)
    loc_s = str(loc).strip() if loc else None
    sop_s = str(sop).strip() if sop else None
    est = getattr(t, "estimated_duration", None)
    skill_type = getattr(t, "skill_type", None)
    material_notes = getattr(t, "material_notes", None)
    phase_group = getattr(t, "phase_group", None)
    planned_start_at = getattr(t, "planned_start_at", None)
    planned_end_at = getattr(t, "planned_end_at", None)
    raw_skills = getattr(t, "required_skill_names", None) or []
    skill_list: list[str] = []
    if isinstance(raw_skills, list):
        for x in raw_skills:
            s = str(x).strip()
            if s and s not in skill_list:
                skill_list.append(s)
            if len(skill_list) >= 32:
                break
    is_ready = st == "todo" and not is_blocked
    _today = datetime.now(timezone.utc).date()
    _ud = getattr(t, "updated_at", None)
    is_overdue = bool(t.due_date and t.due_date < _today and st != "complete")
    is_stale = bool(
        st != "complete"
        and _ud is not None
        and (datetime.now(timezone.utc) - _ud).total_seconds() > 86400
    )
    return TaskOut(
        id=str(t.id),
        company_id=str(t.company_id),
        project_id=str(t.project_id),
        title=t.title,
        description=t.description,
        assigned_user_id=str(t.assigned_user_id) if t.assigned_user_id else None,
        priority=pr,
        status=st,
        required_skill_names=skill_list,
        due_date=t.due_date,
        estimated_duration=str(est).strip() if est else None,
        skill_type=str(skill_type).strip() if skill_type else None,
        material_notes=material_notes,
        phase_group=str(phase_group).strip() if phase_group else None,
        planned_start_at=planned_start_at,
        planned_end_at=planned_end_at,
        calendar_shift_id=sid,
        calendar_event_id=sid,
        created_at=t.created_at,
        updated_at=t.updated_at,
        is_blocked=is_blocked,
        is_ready=is_ready,
        is_overdue=is_overdue,
        is_stale=is_stale,
        location_tag_id=loc_s,
        sop_id=sop_s,
        blocking_tasks=list(blocking_tasks or []),
        depends_on_task_ids=list(depends_on_task_ids or []),
    )


class ReadyTaskOut(BaseModel):
    id: str
    title: str
    priority: str
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    project_id: str
    location_tag_id: Optional[str] = None
    sop_id: Optional[str] = None


class ProximityEventIn(BaseModel):
    user_id: str = Field(..., min_length=1)
    location_tag_id: str = Field(..., min_length=1, max_length=128)
    timestamp: Optional[str] = Field(None, description="ISO-8601 client or gateway time (informational)")


class ProximityTaskOut(BaseModel):
    id: str
    title: str
    priority: str
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    project_id: str
    sop_id: Optional[str] = None


class ProximityTasksResponse(BaseModel):
    tasks: list[ProximityTaskOut]
    equipment_label: str = ""
    event_log_id: Optional[str] = None


class TaskHealthItem(BaseModel):
    id: str
    project_id: str
    project_name: str = ""
    title: str
    priority: str
    status: str
    due_date: Optional[date] = None
    assigned_user_id: Optional[str] = None
    is_blocked: bool = False
    is_overdue: bool = False
    is_stale: bool = False


class TaskHealthReport(BaseModel):
    overdue: list[TaskHealthItem] = Field(default_factory=list)
    stale: list[TaskHealthItem] = Field(default_factory=list)
    blocked: list[TaskHealthItem] = Field(default_factory=list)


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
    last_activity_at: Optional[datetime] = None
    health_status: str = "On Track"


class ProjectTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    default_goal: Optional[str] = None
    default_notes: Optional[str] = None
    default_success_definition: Optional[str] = None


class ProjectTemplateTaskOut(BaseModel):
    id: str
    template_id: str
    title: str
    description: Optional[str] = None
    suggested_duration: Optional[str] = None
    skill_type: Optional[str] = None
    material_notes: Optional[str] = None
    order_index: int = 0
    phase_group: Optional[str] = None


class ProjectTemplateDetailOut(ProjectTemplateOut):
    tasks: list[ProjectTemplateTaskOut] = Field(default_factory=list)


class ProjectTemplateTaskCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    suggested_duration: Optional[str] = Field(None, max_length=64)
    skill_type: Optional[str] = Field(None, max_length=128)
    material_notes: Optional[str] = None
    order_index: int = 0
    phase_group: Optional[str] = Field(None, max_length=128)


class ProjectTemplateCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    default_goal: Optional[str] = None
    default_notes: Optional[str] = None
    default_success_definition: Optional[str] = None
    tasks: list[ProjectTemplateTaskCreateIn] = Field(
        default_factory=list, description="Optional seed tasks for the template"
    )
