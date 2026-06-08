"""Operational improvements API schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

OperationalImprovementStatusLiteral = Literal[
    "identified",
    "analyzing",
    "planning",
    "implementing",
    "measuring",
    "completed",
    "awaiting_review",
    "archived",
]

OperationalImprovementPriorityLiteral = Literal["low", "medium", "high", "critical"]

OperationalImprovementCategoryLiteral = Literal[
    "inventory",
    "procurement",
    "communication",
    "scheduling",
    "maintenance",
    "safety",
    "quality",
    "documentation",
    "other",
]

OperationalImprovementAnalysisTypeLiteral = Literal[
    "root_cause_5_whys",
    "fishbone",
    "process_analysis",
    "five_s",
    "kanban",
    "kaizen",
    "standardization",
    "lean_waste",
    "value_stream_map",
]

OperationalImprovementActionStatusLiteral = Literal[
    "pending",
    "in_progress",
    "done",
    "blocked",
    "cancelled",
]

AttachmentTypeLiteral = Literal["photo", "diagram", "document", "process_map", "other"]


class OperationalImprovementAnalysisOut(BaseModel):
    id: str
    company_id: str
    improvement_id: str
    analysis_type: str
    title: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OperationalImprovementActionOut(BaseModel):
    id: str
    company_id: str
    improvement_id: str
    action: str
    owner_user_id: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    linked_work_request_id: Optional[str] = None
    linked_project_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OperationalImprovementAttachmentOut(BaseModel):
    id: str
    company_id: str
    improvement_id: str
    file_name: str
    file_url: Optional[str] = None
    attachment_type: str
    caption: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    created_at: datetime


class OperationalImprovementOut(BaseModel):
    id: str
    company_id: str
    display_id: Optional[str] = None
    display_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    department_slug: Optional[str] = None
    location: Optional[str] = None
    zone_id: Optional[str] = None
    reporter_user_id: Optional[str] = None
    date_identified: Optional[date] = None
    priority: str
    category: str
    estimated_impact: Optional[str] = None
    current_symptoms: Optional[str] = None
    stakeholders_affected: Optional[str] = None
    status: str
    implementation_data: dict[str, Any] = Field(default_factory=dict)
    measurement_data: dict[str, Any] = Field(default_factory=dict)
    framework_data: dict[str, Any] = Field(default_factory=dict)
    knowledge_base_published: bool = False
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    analyses: list[OperationalImprovementAnalysisOut] = Field(default_factory=list)
    actions: list[OperationalImprovementActionOut] = Field(default_factory=list)
    attachments: list[OperationalImprovementAttachmentOut] = Field(default_factory=list)


class OperationalImprovementListOut(BaseModel):
    id: str
    company_id: str
    display_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    department_slug: Optional[str] = None
    location: Optional[str] = None
    priority: str
    category: str
    estimated_impact: Optional[str] = None
    status: str
    date_identified: Optional[date] = None
    knowledge_base_published: bool = False
    created_at: datetime
    updated_at: datetime
    action_count: int = 0
    analysis_count: int = 0
    prioritization_quadrant: Optional[str] = None
    template_id: Optional[str] = None


class OperationalImprovementCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: Optional[str] = None
    department_slug: Optional[str] = None
    location: Optional[str] = None
    zone_id: Optional[str] = None
    reporter_user_id: Optional[str] = None
    date_identified: Optional[date] = None
    priority: OperationalImprovementPriorityLiteral = "medium"
    category: OperationalImprovementCategoryLiteral = "other"
    estimated_impact: Optional[str] = None
    current_symptoms: Optional[str] = None
    stakeholders_affected: Optional[str] = None
    status: OperationalImprovementStatusLiteral = "identified"
    framework_data: Optional[dict[str, Any]] = None


class OperationalImprovementPatchIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=512)
    description: Optional[str] = None
    department_slug: Optional[str] = None
    location: Optional[str] = None
    zone_id: Optional[str] = None
    reporter_user_id: Optional[str] = None
    date_identified: Optional[date] = None
    priority: Optional[OperationalImprovementPriorityLiteral] = None
    category: Optional[OperationalImprovementCategoryLiteral] = None
    estimated_impact: Optional[str] = None
    current_symptoms: Optional[str] = None
    stakeholders_affected: Optional[str] = None
    status: Optional[OperationalImprovementStatusLiteral] = None
    implementation_data: Optional[dict[str, Any]] = None
    measurement_data: Optional[dict[str, Any]] = None
    framework_data: Optional[dict[str, Any]] = None
    knowledge_base_published: Optional[bool] = None


class OperationalImprovementAnalysisCreateIn(BaseModel):
    analysis_type: OperationalImprovementAnalysisTypeLiteral
    title: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)


class OperationalImprovementAnalysisPatchIn(BaseModel):
    title: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class OperationalImprovementActionCreateIn(BaseModel):
    action: str = Field(min_length=1)
    owner_user_id: Optional[str] = None
    due_date: Optional[date] = None
    status: OperationalImprovementActionStatusLiteral = "pending"
    notes: Optional[str] = None
    linked_work_request_id: Optional[str] = None
    linked_project_id: Optional[str] = None


class OperationalImprovementActionPatchIn(BaseModel):
    action: Optional[str] = Field(default=None, min_length=1)
    owner_user_id: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[OperationalImprovementActionStatusLiteral] = None
    notes: Optional[str] = None
    linked_work_request_id: Optional[str] = None
    linked_project_id: Optional[str] = None


class OperationalImprovementAttachmentCreateIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_url: Optional[str] = None
    attachment_type: AttachmentTypeLiteral = "document"
    caption: Optional[str] = None


class OperationalImprovementStatsOut(BaseModel):
    open_count: int
    completed_count: int
    awaiting_review_count: int
    by_status: dict[str, int]
    by_category: dict[str, int]
    high_impact_open: int
    completion_rate: float = 0.0
    total_count: int = 0
    quick_wins_completed: int = 0
    knowledge_base_count: int = 0
    estimated_savings_total: float = 0.0
    open_by_department: dict[str, int] = Field(default_factory=dict)
    by_prioritization_quadrant: dict[str, int] = Field(default_factory=dict)
    top_root_causes: list[dict[str, Any]] = Field(default_factory=list)
    top_waste_categories: list[dict[str, Any]] = Field(default_factory=list)


class OperationalImprovementPlaybookOut(BaseModel):
    id: str
    company_id: str
    source_improvement_id: Optional[str] = None
    title: str
    category: str
    template_id: Optional[str] = None
    problem: Optional[str] = None
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    results: Optional[str] = None
    lessons_learned: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: datetime


class OperationalImprovementPlaybookCreateIn(BaseModel):
    title: Optional[str] = None
    source_improvement_id: Optional[str] = None


class OperationalImprovementCaseStudyOut(BaseModel):
    id: str
    display_id: Optional[str] = None
    title: str
    category: str
    department_slug: Optional[str] = None
    location: Optional[str] = None
    problem: Optional[str] = None
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    results: Optional[str] = None
    lessons_learned: Optional[str] = None
    completed_at: Optional[date] = None
    published_at: datetime
