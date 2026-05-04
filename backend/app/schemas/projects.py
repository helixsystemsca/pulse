"""Pydantic schemas for tenant projects and tasks."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: date
    status: str = Field(default="active", description="active | future | completed | on_hold | archived")
    owner_user_id: Optional[str] = Field(None, description="User id within the tenant")
    template_id: Optional[str] = Field(None, description="Optional project template id")
    category_id: Optional[str] = Field(None, description="Optional category id")
    repopulation_frequency: Optional[str] = Field(
        None, description="Once | Quarterly | Semi-Annual | Annual"
    )


class ProjectPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    owner_user_id: Optional[str] = None
    category_id: Optional[str] = None
    repopulation_frequency: Optional[str] = None
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
    repopulation_frequency: Optional[str] = None
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    notification_enabled: bool = False
    notification_material_days: int = 30
    notification_equipment_days: int = 7
    notification_to_supervision: bool = False
    notification_to_lead: bool = False
    notification_to_owner: bool = True
    created_at: datetime
    updated_at: datetime
    health_status: str = "On Track"

    model_config = {"from_attributes": True}


class ProjectNotificationSettingsOut(BaseModel):
    project_id: str
    notification_enabled: bool
    notification_material_days: int
    notification_equipment_days: int
    notification_to_supervision: bool
    notification_to_lead: bool
    notification_to_owner: bool


class ProjectNotificationSettingsPatch(BaseModel):
    notification_enabled: Optional[bool] = None
    notification_material_days: Optional[int] = Field(None, ge=1, le=365)
    notification_equipment_days: Optional[int] = Field(None, ge=1, le=365)
    notification_to_supervision: Optional[bool] = None
    notification_to_lead: Optional[bool] = None
    notification_to_owner: Optional[bool] = None


NOTIFICATION_RULE_CONDITION_KEYS = frozenset(
    {"has_materials", "material_status_in", "fallback_to_existence_if_no_inventory"}
)
TASK_MATERIAL_STATUS_VALUES = frozenset({"in_stock", "needs_order", "ordered", "received"})
NOTIFICATION_RECIPIENT_ROLES = frozenset({"supervisor", "lead", "owner"})


class NotificationRuleCreateIn(BaseModel):
    type: str = Field(..., min_length=1, max_length=64)
    enabled: bool = True
    offset_days: int
    conditions: dict[str, Any] = Field(default_factory=dict)
    recipients: list[str] = Field(default_factory=list)

    @field_validator("type", mode="after")
    @classmethod
    def strip_rule_type(cls, v: str) -> str:
        t = v.strip()
        if not t:
            raise ValueError("type is required")
        return t

    @field_validator("conditions", mode="after")
    @classmethod
    def validate_conditions(cls, v: dict[str, Any]) -> dict[str, Any]:
        for k in v:
            if k not in NOTIFICATION_RULE_CONDITION_KEYS:
                raise ValueError(f"Unknown conditions key: {k!r}")
        hm = v.get("has_materials")
        if hm is not None and not isinstance(hm, bool):
            raise ValueError("has_materials must be a boolean")
        fb = v.get("fallback_to_existence_if_no_inventory")
        if fb is not None and not isinstance(fb, bool):
            raise ValueError("fallback_to_existence_if_no_inventory must be a boolean")
        raw_ms = v.get("material_status_in")
        if raw_ms is None:
            return dict(v)
        if not isinstance(raw_ms, list):
            raise ValueError("material_status_in must be a list of status strings")
        norm: list[str] = []
        for s in raw_ms:
            st = str(s).strip().lower()
            if st not in TASK_MATERIAL_STATUS_VALUES:
                raise ValueError(f"Invalid material status: {s!r}")
            if st not in norm:
                norm.append(st)
        out = dict(v)
        out["material_status_in"] = norm
        return out

    @field_validator("recipients", mode="after")
    @classmethod
    def validate_recipients(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for x in v:
            r = str(x).strip().lower()
            if r == "supervision":
                r = "supervisor"
            if r not in NOTIFICATION_RECIPIENT_ROLES:
                raise ValueError(f"Invalid recipient role: {x!r}")
            if r not in out:
                out.append(r)
        return out


class NotificationRuleOut(BaseModel):
    id: str
    project_id: str
    company_id: str
    type: str
    enabled: bool
    offset_days: int
    conditions: dict[str, Any]
    recipients: list[str]
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
    # New planning fields (preferred over due_date).
    start_date: Optional[date] = None
    estimated_completion_minutes: Optional[int] = Field(None, ge=1, le=60 * 24 * 365)
    # Legacy fields (kept for backward compatibility).
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
    start_date: Optional[date] = None
    estimated_completion_minutes: Optional[int] = Field(None, ge=1, le=60 * 24 * 365)
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
    start_date: Optional[date] = None
    estimated_completion_minutes: Optional[int] = None
    end_date: Optional[date] = None
    actual_completion_minutes: Optional[int] = None
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


class TaskMaterialCreateIn(BaseModel):
    inventory_item_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    quantity_required: float = Field(default=1, gt=0)
    unit: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = Field(None, max_length=2000)
    status: str = Field(default="in_stock", description="in_stock | needs_order | ordered | received")

    @field_validator("status", mode="after")
    @classmethod
    def validate_material_status(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in TASK_MATERIAL_STATUS_VALUES:
            raise ValueError(f"Invalid material status: {v!r}")
        return s


class TaskMaterialPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity_required: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = Field(None, max_length=2000)
    inventory_item_id: Optional[str] = None
    status: Optional[str] = Field(None, description="in_stock | needs_order | ordered | received")

    @field_validator("status", mode="after")
    @classmethod
    def validate_material_status_patch(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip().lower()
        if s not in TASK_MATERIAL_STATUS_VALUES:
            raise ValueError(f"Invalid material status: {v!r}")
        return s


class TaskMaterialOut(BaseModel):
    id: str
    company_id: str
    project_id: str
    task_id: str
    inventory_item_id: Optional[str] = None
    name: str
    quantity_required: float
    unit: Optional[str] = None
    notes: Optional[str] = None
    status: str = "in_stock"
    created_at: datetime
    updated_at: datetime

    # Enriched inventory snapshot for warnings.
    inventory_quantity: Optional[float] = None
    low_stock_threshold: Optional[float] = None
    is_out_of_stock: bool = False
    is_low_stock: bool = False


class ProjectMaterialSummaryRow(BaseModel):
    inventory_item_id: Optional[str] = None
    name: str
    unit: Optional[str] = None
    quantity_required_total: float
    inventory_quantity: Optional[float] = None
    low_stock_threshold: Optional[float] = None
    is_out_of_stock: bool = False
    is_low_stock: bool = False


class TaskEquipmentCreateIn(BaseModel):
    facility_equipment_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class TaskEquipmentPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)
    facility_equipment_id: Optional[str] = None


class TaskEquipmentOut(BaseModel):
    id: str
    company_id: str
    project_id: str
    task_id: str
    facility_equipment_id: Optional[str] = None
    name: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    equipment_type: Optional[str] = None
    equipment_status: Optional[str] = None


class ProjectEquipmentSummaryRow(BaseModel):
    facility_equipment_id: Optional[str] = None
    name: str
    line_count: int = 0


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


class CriticalStepOut(BaseModel):
    id: str
    project_id: str
    title: str
    order_index: int
    depends_on_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CriticalStepCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    order_index: int = Field(default=0, ge=0)
    depends_on_id: Optional[str] = None


class CriticalStepPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    order_index: Optional[int] = Field(None, ge=0)
    depends_on_id: Optional[str] = None


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
    start_date = getattr(t, "start_date", None)
    est_min = getattr(t, "estimated_completion_minutes", None)
    end_date = getattr(t, "end_date", None)
    actual_min = getattr(t, "actual_completion_minutes", None)
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
    # Overdue is derived from the preferred planning fields when possible.
    derived_due: Optional[date] = None
    if start_date and isinstance(est_min, int) and est_min > 0:
        # Convert minutes → days (ceil) since we're working at date resolution.
        days = (est_min + 1440 - 1) // 1440
        derived_due = start_date.fromordinal(start_date.toordinal() + int(days))
    is_overdue = bool((t.due_date or derived_due) and (t.due_date or derived_due) < _today and st != "complete")
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
        start_date=start_date,
        estimated_completion_minutes=int(est_min) if isinstance(est_min, int) else None,
        end_date=end_date,
        actual_completion_minutes=int(actual_min) if isinstance(actual_min, int) else None,
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
