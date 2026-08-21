"""Schemas for Phase 1 personal command center."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# —— Profile ——
class OpsPersonalProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    display_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    manager_name: Optional[str] = None
    start_date: Optional[date] = None
    contact_info: Optional[str] = None
    certifications: list[Any] = Field(default_factory=list)
    qualifications: list[Any] = Field(default_factory=list)
    philosophy: dict[str, Any] = Field(default_factory=dict)
    principles: list[Any] = Field(default_factory=list)
    role_purpose: Optional[str] = None
    linked_ops_person_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OpsPersonalProfilePatchIn(BaseModel):
    display_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    manager_name: Optional[str] = None
    start_date: Optional[date] = None
    contact_info: Optional[str] = None
    certifications: Optional[list[Any]] = None
    qualifications: Optional[list[Any]] = None
    philosophy: Optional[dict[str, Any]] = None
    principles: Optional[list[Any]] = None
    role_purpose: Optional[str] = None
    linked_ops_person_id: Optional[str] = None
    notes: Optional[str] = None


# —— Responsibilities ——
class OpsRoleResponsibilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    category: str
    title: str
    description: Optional[str] = None
    priority: str
    frequency: Optional[str] = None
    notes: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class OpsRoleResponsibilityCreateIn(BaseModel):
    category: str = Field(default="Operations", max_length=64)
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    priority: str = Field(default="medium", max_length=32)
    frequency: Optional[str] = None
    notes: Optional[str] = None
    sort_order: int = 0


class OpsRoleResponsibilityPatchIn(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    priority: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


# —— Authority ——
class OpsAuthorityRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    decision: str
    levels: dict[str, Any] = Field(default_factory=dict)
    status: str
    notes: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class OpsAuthorityRowCreateIn(BaseModel):
    decision: str = Field(..., min_length=1, max_length=512)
    levels: dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="unknown", max_length=32)
    notes: Optional[str] = None
    sort_order: int = 0


class OpsAuthorityRowPatchIn(BaseModel):
    decision: Optional[str] = None
    levels: Optional[dict[str, Any]] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


# —— Checklists ——
class OpsChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    instance_id: str
    section: str
    title: str
    description: Optional[str] = None
    completed: bool
    completed_at: Optional[datetime] = None
    due_date: Optional[date] = None
    priority: str
    notes: Optional[str] = None
    sort_order: int


class OpsChecklistItemPatchIn(BaseModel):
    completed: Optional[bool] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    section: Optional[str] = None


class OpsChecklistInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    template_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    status: str
    due_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[OpsChecklistItemOut] = Field(default_factory=list)
    progress_pct: int = 0


class OpsChecklistTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    description: Optional[str] = None
    category: str
    structure: list[Any] = Field(default_factory=list)
    is_system: bool


class OpsChecklistStartIn(BaseModel):
    template_slug: Optional[str] = None
    template_id: Optional[str] = None
    title: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "medium"


# —— Knowledge gaps ——
class OpsKnowledgeGapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    question: str
    category: str
    priority: str
    who_should_answer: Optional[str] = None
    status: str
    answer: Optional[str] = None
    source: Optional[str] = None
    date_confirmed: Optional[date] = None
    related_policy: Optional[str] = None
    related_person: Optional[str] = None
    related_procedure: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OpsKnowledgeGapCreateIn(BaseModel):
    question: str = Field(..., min_length=1)
    category: str = Field(default="General", max_length=128)
    priority: str = Field(default="medium", max_length=32)
    who_should_answer: Optional[str] = None
    status: str = Field(default="open", max_length=32)
    notes: Optional[str] = None


class OpsKnowledgeGapPatchIn(BaseModel):
    question: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    who_should_answer: Optional[str] = None
    status: Optional[str] = None
    answer: Optional[str] = None
    source: Optional[str] = None
    date_confirmed: Optional[date] = None
    related_policy: Optional[str] = None
    related_person: Optional[str] = None
    related_procedure: Optional[str] = None
    notes: Optional[str] = None


# —— Dashboard summary ——
class OpsCommandDashboardOut(BaseModel):
    checklist_due_today: int = 0
    checklist_overdue: int = 0
    checklist_open_items: int = 0
    active_checklists: int = 0
    knowledge_gaps_open: int = 0
    knowledge_gaps_high: int = 0
    authority_unknown: int = 0
    profile_complete: bool = False
    due_items: list[dict[str, Any]] = Field(default_factory=list)
    open_gaps: list[dict[str, Any]] = Field(default_factory=list)
    active_checklist_summaries: list[dict[str, Any]] = Field(default_factory=list)
    open_team_risks: int = 0
    people_count: int = 0
    # Phase 3 operational intelligence
    assets_needing_attention: int = 0
    inventory_low_stock: int = 0
    training_overdue: int = 0
    compliance_missed: int = 0
    critical_procedures: int = 0
    emergency_readiness_gaps: int = 0
    intelligence_items: list[dict[str, Any]] = Field(default_factory=list)
    # Phase 4 planning
    active_projects: int = 0
    overdue_project_tasks: int = 0
    roadmap_behind: int = 0
    pm_coord_risks: int = 0
    overdue_work_requests: int = 0
    roadmap_with_budget: int = 0


class OpsIntelligenceOut(BaseModel):
    assets: dict[str, Any] = Field(default_factory=dict)
    inventory: dict[str, Any] = Field(default_factory=dict)
    procedures: dict[str, Any] = Field(default_factory=dict)
    training: dict[str, Any] = Field(default_factory=dict)
    compliance: dict[str, Any] = Field(default_factory=dict)
    emergency: dict[str, Any] = Field(default_factory=dict)
    projects: dict[str, Any] = Field(default_factory=dict)
    planning_risks: dict[str, Any] = Field(default_factory=dict)
    budget: dict[str, Any] = Field(default_factory=dict)
    maintenance: dict[str, Any] = Field(default_factory=dict)
    attention_items: list[dict[str, Any]] = Field(default_factory=list)
    totals: dict[str, int] = Field(default_factory=dict)


# —— Phase 2 Organization ——
class OpsOrgNodeOut(BaseModel):
    id: str
    title: str
    position: Optional[str] = None
    department: Optional[str] = None
    team_name: Optional[str] = None
    role_label: Optional[str] = None
    reports_to_person_id: Optional[str] = None
    status: str = "active"
    children: list["OpsOrgNodeOut"] = Field(default_factory=list)


class OpsSkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    description: Optional[str] = None
    sort_order: int = 0


class OpsSkillCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="General", max_length=128)
    description: Optional[str] = None
    sort_order: int = 0


class OpsSkillPatchIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class OpsSkillRatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    skill_id: str
    person_id: str
    proficiency: str
    certification: Optional[str] = None
    last_demonstrated: Optional[date] = None
    training_required: bool = False
    cross_training_status: Optional[str] = None
    notes: Optional[str] = None
    skill_name: Optional[str] = None
    person_name: Optional[str] = None


class OpsSkillRatingUpsertIn(BaseModel):
    skill_id: str
    person_id: str
    proficiency: str = Field(default="beginner", max_length=32)
    certification: Optional[str] = None
    last_demonstrated: Optional[date] = None
    training_required: bool = False
    cross_training_status: Optional[str] = None
    notes: Optional[str] = None


class OpsDevelopmentPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    person_id: str
    title: str
    strengths: Optional[str] = None
    development_goals: Optional[str] = None
    training: Optional[str] = None
    mentoring: Optional[str] = None
    cross_training: Optional[str] = None
    target_date: Optional[date] = None
    progress: str
    status: str
    notes: Optional[str] = None
    person_name: Optional[str] = None


class OpsDevelopmentPlanCreateIn(BaseModel):
    person_id: str
    title: str = Field(default="Development plan", max_length=512)
    strengths: Optional[str] = None
    development_goals: Optional[str] = None
    training: Optional[str] = None
    mentoring: Optional[str] = None
    cross_training: Optional[str] = None
    target_date: Optional[date] = None
    progress: str = "not_started"
    status: str = "active"
    notes: Optional[str] = None


class OpsDevelopmentPlanPatchIn(BaseModel):
    title: Optional[str] = None
    strengths: Optional[str] = None
    development_goals: Optional[str] = None
    training: Optional[str] = None
    mentoring: Optional[str] = None
    cross_training: Optional[str] = None
    target_date: Optional[date] = None
    progress: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class OpsTeamRiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    risk_type: str
    description: Optional[str] = None
    severity: str
    related_person_id: Optional[str] = None
    related_skill: Optional[str] = None
    status: str
    mitigation: Optional[str] = None
    notes: Optional[str] = None
    person_name: Optional[str] = None


class OpsTeamRiskCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    risk_type: str = Field(default="skill_shortage", max_length=64)
    description: Optional[str] = None
    severity: str = Field(default="medium", max_length=32)
    related_person_id: Optional[str] = None
    related_skill: Optional[str] = None
    status: str = "open"
    mitigation: Optional[str] = None
    notes: Optional[str] = None


class OpsTeamRiskPatchIn(BaseModel):
    title: Optional[str] = None
    risk_type: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    related_person_id: Optional[str] = None
    related_skill: Optional[str] = None
    status: Optional[str] = None
    mitigation: Optional[str] = None
    notes: Optional[str] = None
