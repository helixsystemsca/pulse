"""Per-day employee availability (auxiliary schedule builder)."""

from __future__ import annotations

from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field


class EmployeeAvailabilityOut(BaseModel):
    id: str
    employee_id: str
    date: date
    status: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    restriction_type: Optional[str] = None
    notes: Optional[str] = None
    source: str
    imported_from: Optional[str] = None

    model_config = {"from_attributes": True}


class EmployeeAvailabilitySeedResult(BaseModel):
    employees_matched: int
    employees_missing: list[str]
    entries_created: int
    entries_skipped_duplicates: int
    wiped_rows: int
    execution_ms: int
