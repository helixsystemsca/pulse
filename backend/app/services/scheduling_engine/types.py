"""Shared types for the draft scheduling engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


@dataclass
class DraftSlot:
    date: date
    start_min: int
    end_min: int
    shift_type: str
    shift_definition_id: str | None = None
    shift_code: str | None = None
    required_certs: list[str] = field(default_factory=list)
    facility_id: str | None = None
    staffing_requirement_id: str | None = None


@dataclass
class StaffingRequirement:
    id: str
    date: date
    shift_type: str
    required_count: int
    required_certifications: list[str]
    zone_id: str | None
    source: str
    confidence_score: float
    event_id: str | None = None


@dataclass
class DraftAssignment:
    slot: DraftSlot
    user_id: str
    user_name: str
    score: float
    confidence_score: float
    recommendation_reason: str
    warnings: list[str] = field(default_factory=list)
    generated_by: str = "scheduling_engine"


@dataclass
class DraftConflict:
    slot: DraftSlot
    reason: str


@dataclass
class StaffingGap:
    date: str
    shift_type: str
    message: str
    shortfall: int
    missing_certifications: list[str] = field(default_factory=list)


@dataclass
class HistoricalPatterns:
    """Inferred from prior published/work shifts."""

    avg_staff_by_weekday: dict[int, float]
    avg_staff_by_shift_type: dict[str, float]
    cert_ratios: dict[str, float]
    auxiliary_share: float
    overnight_share: float
    worker_shift_counts: dict[str, int]
    worker_overnight_counts: dict[str, int]
    worker_gg_counts: dict[str, int]
    worker_day_counts: dict[str, int]
    sample_days: int


@dataclass
class WorkerContext:
    user_id: str
    name: str
    certifications: list[str]
    employment_type: str | None
    scheduling: dict[str, Any]
    availability_rows: list[dict[str, Any]]


@dataclass
class GenerateDraftOptions:
    period_start: date
    period_end: date
    department_slug: str | None = None
    max_hours_per_worker: float = 160.0
    fairness_enabled: bool = True
    historical_lookback_days: int = 84
    regenerate_dates: list[date] | None = None
    respect_locked: bool = True


@dataclass
class DraftGenerationResult:
    assignments: list[DraftAssignment]
    conflicts: list[DraftConflict]
    gaps: list[StaffingGap]
    staffing_requirements: list[StaffingRequirement]
    total_slots: int
    patterns_summary: dict[str, Any]
