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


class RoutineRunCreateIn(BaseModel):
    routine_id: str
    shift_id: Optional[str] = None
    items: list[RoutineItemRunIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _missed_notes_required(self) -> "RoutineRunCreateIn":
        # Critical behavior: if an item is not completed, a note must be supplied.
        for it in self.items:
            if it.completed:
                continue
            if not (it.note or "").strip():
                raise ValueError("Missed items require notes before sign-off.")
        return self


class RoutineRunOut(BaseModel):
    id: str
    company_id: str
    routine_id: str
    user_id: Optional[str] = None
    shift_id: Optional[str] = None
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

    model_config = {"from_attributes": True}


class RoutineRunDetailOut(RoutineRunOut):
    items: list[RoutineItemRunOut] = Field(default_factory=list)


RoutineDetailOut.model_rebuild()

