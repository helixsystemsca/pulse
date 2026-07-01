"""Schemas for worker meetings and action items."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

MeetingStatus = Literal["upcoming", "completed", "cancelled"]
MeetingType = Literal["one_on_one", "team"]
ActionItemStatus = Literal["open", "in_progress", "done", "cancelled"]


class MeetingActionItemOut(BaseModel):
    id: str
    meeting_id: Optional[str] = None
    employee_user_id: str
    assigned_to_user_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    title: str
    due_date: Optional[date] = None
    status: str = "open"
    notes: Optional[str] = None
    project_id: Optional[str] = None


class MeetingActionItemIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    assigned_to_user_id: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "open"
    notes: Optional[str] = None
    project_id: Optional[str] = None


class WorkerMeetingOut(BaseModel):
    id: str
    employee_user_id: str
    employee_name: Optional[str] = None
    manager_user_id: Optional[str] = None
    manager_name: Optional[str] = None
    meeting_type: str = "one_on_one"
    scheduled_date: Optional[date] = None
    status: str = "upcoming"
    agenda: Optional[str] = None
    wins: Optional[str] = None
    challenges: Optional[str] = None
    goals: Optional[str] = None
    manager_notes: Optional[str] = None
    employee_notes: Optional[str] = None
    next_meeting_date: Optional[date] = None
    recurrence: Optional[str] = None
    action_items: list[MeetingActionItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class WorkerMeetingListOut(BaseModel):
    items: list[WorkerMeetingOut]


class WorkerMeetingCreateIn(BaseModel):
    employee_user_id: str
    meeting_type: str = "one_on_one"
    scheduled_date: Optional[date] = None
    status: str = "upcoming"
    agenda: Optional[str] = None
    wins: Optional[str] = None
    challenges: Optional[str] = None
    goals: Optional[str] = None
    manager_notes: Optional[str] = None
    employee_notes: Optional[str] = None
    next_meeting_date: Optional[date] = None
    recurrence: Optional[str] = None
    action_items: list[MeetingActionItemIn] = Field(default_factory=list)


class WorkerMeetingPatchIn(BaseModel):
    scheduled_date: Optional[date] = None
    status: Optional[str] = None
    agenda: Optional[str] = None
    wins: Optional[str] = None
    challenges: Optional[str] = None
    goals: Optional[str] = None
    manager_notes: Optional[str] = None
    employee_notes: Optional[str] = None
    next_meeting_date: Optional[date] = None
    recurrence: Optional[str] = None
    action_items: Optional[list[MeetingActionItemIn]] = None


class ActionItemListOut(BaseModel):
    items: list[MeetingActionItemOut]
