"""Pydantic schemas for gamified tasks + XP."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

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

