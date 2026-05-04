"""Pydantic models for project summary payloads (API / JSON contract)."""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

OutcomeResult = Literal["success", "partial", "fail"]


class SummaryOverview(BaseModel):
    project_name: str
    project_type: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner: str
    success_flag: Optional[bool] = None


class SummaryScope(BaseModel):
    planned_tasks: int = 0
    completed_tasks: int = 0
    scope_changes: list[str] = Field(default_factory=list)


class SummarySchedule(BaseModel):
    planned_duration_days: int = 0
    actual_duration_days: Optional[int] = None
    variance_days: Optional[int] = None
    delayed_tasks: int = 0


class SummaryResources(BaseModel):
    team_members: list[str] = Field(default_factory=list)
    total_hours: Optional[float] = None
    task_distribution: dict[str, float] = Field(
        default_factory=dict,
        description="Maps user_id to percentage of task effort (0–100).",
    )


class SummaryQuality(BaseModel):
    inspections_passed: int = 0
    inspections_failed: int = 0
    rework_count: int = 0


class SummaryRisks(BaseModel):
    issue_count: int = 0
    major_issues: list[str] = Field(default_factory=list)


class SummaryCommunication(BaseModel):
    update_count: int = 0
    avg_response_time: Optional[float] = None


class SummaryStakeholders(BaseModel):
    satisfaction_score: Optional[float] = None


class SummaryLessons(BaseModel):
    went_well: str = ""
    didnt_go_well: str = ""
    improvements: str = ""


class SummaryOutcome(BaseModel):
    result: OutcomeResult
    summary: str = ""


class ProjectSummary(BaseModel):
    """Structured project summary (sections align to the core JSON contract)."""

    project_id: str
    overview: SummaryOverview
    scope: SummaryScope
    schedule: SummarySchedule
    resources: SummaryResources
    quality: SummaryQuality
    risks: SummaryRisks
    communication: SummaryCommunication
    stakeholders: SummaryStakeholders
    lessons: SummaryLessons
    outcome: SummaryOutcome
