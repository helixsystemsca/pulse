"""Routines (Standards) — templates + execution archive."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class RoutineItemIn(BaseModel):
    id: Optional[str] = None
    label: str = Field(..., min_length=1, max_length=8000)
    position: int = Field(..., ge=0, le=100000)
    required: bool = True


class RoutineOut(BaseModel):
    id: str
    company_id: str
    name: str
    zone_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoutineDetailOut(RoutineOut):
    items: list["RoutineItemOut"] = Field(default_factory=list)


class RoutineItemOut(BaseModel):
    id: str
    company_id: str
    routine_id: str
    label: str
    position: int
    required: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoutineCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    zone_id: Optional[str] = None
    items: list[RoutineItemIn] = Field(default_factory=list)


class RoutinePatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    zone_id: Optional[str] = None
    items: Optional[list[RoutineItemIn]] = None


RoutineRunStatus = Literal["in_progress", "completed"]


class RoutineItemRunIn(BaseModel):
    routine_item_id: str
    completed: bool = False
    note: Optional[str] = Field(None, max_length=8000)


class RoutineExtraIn(BaseModel):
    id: Optional[str] = None
    label: str = Field(..., min_length=1, max_length=8000)
    assigned_to_user_id: Optional[str] = None


class RoutineItemAssignmentIn(BaseModel):
    routine_item_id: str
    assigned_to_user_id: str
    reason: Optional[str] = Field(None, max_length=64)


class RoutineAssignmentCreateIn(BaseModel):
    routine_id: str
    primary_user_id: str
    date: Optional[str] = None  # YYYY-MM-DD
    shift_id: Optional[str] = None
    item_assignments: list[RoutineItemAssignmentIn] = Field(default_factory=list)
    extras: list[RoutineExtraIn] = Field(default_factory=list)


class RoutineAssignmentOut(BaseModel):
    id: str
    company_id: str
    routine_id: str
    shift_id: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    primary_user_id: str
    assigned_by_user_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoutineAssignmentDetailOut(RoutineAssignmentOut):
    routine: RoutineDetailOut
    item_assignments: list[dict] = Field(default_factory=list)
    extras: list[dict] = Field(default_factory=list)


class RoutineRunCreateIn(BaseModel):
    routine_id: str
    shift_id: Optional[str] = None
    routine_assignment_id: Optional[str] = None
    items: list[RoutineItemRunIn] = Field(default_factory=list)
    extras: list["RoutineExtraRunIn"] = Field(default_factory=list)

    @model_validator(mode="after")
    def _missed_notes_required(self) -> "RoutineRunCreateIn":
        # Critical behavior: if an item is not completed, a note must be supplied.
        for it in self.items:
            if it.completed:
                continue
            if not (it.note or "").strip():
                raise ValueError("Missed items require notes before sign-off.")
        for ex in self.extras:
            if ex.completed:
                continue
            if not (ex.note or "").strip():
                raise ValueError("Missed extras require notes before sign-off.")
        return self


class RoutineRunOut(BaseModel):
    id: str
    company_id: str
    routine_id: str
    user_id: Optional[str] = None
    shift_id: Optional[str] = None
    routine_assignment_id: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: RoutineRunStatus

    model_config = {"from_attributes": True}


class RoutineItemRunOut(BaseModel):
    id: str
    company_id: str
    routine_run_id: str
    routine_item_id: Optional[str] = None
    completed: bool
    note: Optional[str] = None
    completed_by_user_id: Optional[str] = None

    model_config = {"from_attributes": True}


class RoutineRunDetailOut(RoutineRunOut):
    items: list[RoutineItemRunOut] = Field(default_factory=list)
    extras: list["RoutineExtraRunOut"] = Field(default_factory=list)


class RoutineExtraRunIn(BaseModel):
    id: str
    completed: bool = False
    note: Optional[str] = Field(None, max_length=8000)


class RoutineExtraRunOut(BaseModel):
    id: str
    label: str
    assigned_to_user_id: Optional[str] = None
    completed: bool
    completed_by_user_id: Optional[str] = None
    completed_at: Optional[datetime] = None
    note: Optional[str] = None


RoutineRunDetailOut.model_rebuild()
RoutineDetailOut.model_rebuild()

