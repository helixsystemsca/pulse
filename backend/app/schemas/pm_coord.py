"""API schemas for internal PM coordination (`pm_coord_*` tables)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PmCoordProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    objective: Optional[str] = None
    deliverables: Optional[str] = None
    definition_of_done: Optional[str] = None


class PmCoordProjectPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    objective: Optional[str] = None
    deliverables: Optional[str] = None
    definition_of_done: Optional[str] = None
    current_update: Optional[str] = None
    post_project_review: Optional[str] = None
    readiness_tasks_defined: Optional[bool] = None
    readiness_materials_ready: Optional[bool] = None
    readiness_dependencies_set: Optional[bool] = None


class PmCoordTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    parent_task_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(not_started|in_progress|complete)$")
    sort_order: Optional[int] = None


class PmCoordTaskPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    parent_task_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(not_started|in_progress|complete)$")
    sort_order: Optional[int] = None


class PmCoordDependencyCreate(BaseModel):
    depends_on_task_id: str = Field(..., min_length=1)


class PmCoordRiskCreate(BaseModel):
    risk_description: str = Field(..., min_length=1)
    impact: str = Field(default="medium", pattern="^(low|medium|high)$")
    mitigation_notes: Optional[str] = None


class PmCoordRiskPatch(BaseModel):
    risk_description: Optional[str] = Field(None, min_length=1)
    impact: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    mitigation_notes: Optional[str] = None


class PmCoordResourceCreate(BaseModel):
    resource_kind: str = Field(default="material", pattern="^(material|tool|other)$")
    label: str = Field(..., min_length=1, max_length=512)
    notes: Optional[str] = None
    inventory_item_id: Optional[str] = None
    tool_id: Optional[str] = None


class PmCoordResourcePatch(BaseModel):
    resource_kind: Optional[str] = Field(None, pattern="^(material|tool|other)$")
    label: Optional[str] = Field(None, min_length=1, max_length=512)
    notes: Optional[str] = None
    inventory_item_id: Optional[str] = None
    tool_id: Optional[str] = None


class PmCoordTaskResourceOut(BaseModel):
    id: str
    task_id: str
    resource_kind: str
    label: str
    notes: Optional[str] = None
    inventory_item_id: Optional[str] = None
    tool_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PmCoordRiskOut(BaseModel):
    id: str
    project_id: str
    risk_description: str
    impact: str
    mitigation_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PmCoordTaskOut(BaseModel):
    id: str
    project_id: str
    parent_task_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    sort_order: int
    depends_on_task_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    resources: list[PmCoordTaskResourceOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PmCoordProjectSummaryOut(BaseModel):
    id: str
    company_id: str
    name: str
    objective: Optional[str] = None
    readiness_tasks_defined: bool
    readiness_materials_ready: bool
    readiness_dependencies_set: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PmCoordProjectDetailOut(BaseModel):
    id: str
    company_id: str
    name: str
    objective: Optional[str] = None
    deliverables: Optional[str] = None
    definition_of_done: Optional[str] = None
    current_update: Optional[str] = None
    post_project_review: Optional[str] = None
    readiness_tasks_defined: bool
    readiness_materials_ready: bool
    readiness_dependencies_set: bool
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tasks: list[PmCoordTaskOut] = Field(default_factory=list)
    risks: list[PmCoordRiskOut] = Field(default_factory=list)

    class Config:
        from_attributes = True
