"""Pydantic schemas for gamified tasks + XP."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


TaskStatus = Literal["todo", "in_progress", "done"]
TaskSourceType = Literal["work_order", "pm", "project", "routine", "self"]


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    source_type: TaskSourceType
    source_id: Optional[str] = None
    equipment_id: Optional[str] = None
    priority: int = 1
    difficulty: int = 1
    status: TaskStatus
    due_date: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    xp_awarded: int = 0


class CompleteTaskResult(BaseModel):
    xp: int
    totalXp: int = Field(alias="totalXp")
    level: int


class UserAnalyticsOut(BaseModel):
    totalXp: int
    level: int
    tasksCompleted: int
    onTimeRate: float
    avgCompletionTime: float
    reviewScore: float
    initiativeScore: float


class WorkOrderBriefOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    work_order_type: str
    equipment_id: Optional[str] = None
    part_id: Optional[str] = None
    procedure_id: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[str] = None
    attachments: list[Any] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProcedureOut(BaseModel):
    id: str
    title: str
    steps: list[Any] = Field(default_factory=list)


class PartLineOut(BaseModel):
    part_id: str
    quantity: int
    name: Optional[str] = None
    description: Optional[str] = None
    equipment_id: Optional[str] = None


class EquipmentHistoryItemOut(BaseModel):
    id: str
    title: str
    status: str
    updated_at: datetime
    work_order_type: Optional[str] = None


class TaskFullOut(BaseModel):
    task: TaskOut
    work_order: Optional[WorkOrderBriefOut] = None
    procedures: list[ProcedureOut] = Field(default_factory=list)
    parts: list[PartLineOut] = Field(default_factory=list)
    attachments: list[Any] = Field(default_factory=list)
    equipment_history: list[EquipmentHistoryItemOut] = Field(default_factory=list)

