"""Compose summary sections from upstream modules (stubbed services for now)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import TypedDict

from app.services.project_summary.metrics import MockProjectMetrics
from app.services.project_summary.schemas import (
    OutcomeResult,
    SummaryCommunication,
    SummaryLessons,
    SummaryOutcome,
    SummaryOverview,
    SummaryQuality,
    SummaryResources,
    SummaryRisks,
    SummarySchedule,
    SummaryScope,
    SummaryStakeholders,
)
from app.services.project_summary.stub_services import (
    inspection_service,
    log_service,
    task_service,
)


class TaskSummaryDict(TypedDict):
    """Normalized payload for ``SummaryScope``."""

    planned_tasks: int
    completed_tasks: int
    scope_changes: list[str]


class ScheduleSummaryDict(TypedDict, total=False):
    """Normalized payload for ``SummarySchedule``."""

    planned_duration_days: int
    actual_duration_days: int | None
    variance_days: int | None
    delayed_tasks: int


class ResourceSummaryDict(TypedDict, total=False):
    """Normalized payload for ``SummaryResources``."""

    team_members: list[str]
    total_hours: float | None
    task_distribution: dict[str, float]


class QualitySummaryDict(TypedDict):
    """Normalized payload for ``SummaryQuality``."""

    inspections_passed: int
    inspections_failed: int
    rework_count: int


class CommunicationSummaryDict(TypedDict, total=False):
    """Normalized payload for ``SummaryCommunication``."""

    update_count: int
    avg_response_time: float | None


def get_task_summary(project_id: str | int) -> TaskSummaryDict:
    """Pull task rows and normalize to scope fields."""
    tasks = task_service.get_tasks_by_project(project_id)
    if not tasks:
        return TaskSummaryDict(planned_tasks=0, completed_tasks=0, scope_changes=[])

    planned_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("state") == "completed")
    scope_changes = [note for t in tasks if (note := t.get("scope_change_note"))]

    return TaskSummaryDict(
        planned_tasks=planned_tasks,
        completed_tasks=completed_tasks,
        scope_changes=scope_changes,
    )


def _delayed_task_count(tasks: list[dict]) -> int:
    delayed = 0
    for t in tasks:
        if t.get("state") == "delayed":
            delayed += 1
            continue
        fin = t.get("finished_at")
        end = t.get("baseline_end")
        if fin is not None and end is not None and fin > end:
            delayed += 1
    return delayed


def get_schedule_summary(project_id: str | int) -> ScheduleSummaryDict:
    """Derive schedule metrics from the same task feed used for scope."""
    tasks = task_service.get_tasks_by_project(project_id)
    if not tasks:
        return ScheduleSummaryDict(
            planned_duration_days=0,
            actual_duration_days=None,
            variance_days=None,
            delayed_tasks=0,
        )

    baseline_ends = [t["baseline_end"] for t in tasks if t.get("baseline_end") is not None]
    starts_guess = min(baseline_ends) - timedelta(days=5 * len(tasks))
    project_start = starts_guess
    project_end_planned = max(baseline_ends)

    planned_duration_days = max(0, (project_end_planned - project_start).days)

    last_dates: list[date] = []
    for t in tasks:
        if t.get("finished_at") is not None:
            last_dates.append(t["finished_at"])
        elif t.get("baseline_end") is not None:
            last_dates.append(t["baseline_end"])
    last_activity = max(last_dates) if last_dates else project_end_planned
    actual_duration_days = max(0, (last_activity - project_start).days)
    variance_days = actual_duration_days - planned_duration_days

    return ScheduleSummaryDict(
        planned_duration_days=planned_duration_days,
        actual_duration_days=actual_duration_days,
        variance_days=variance_days,
        delayed_tasks=_delayed_task_count(tasks),
    )


def get_resource_summary(project_id: str | int) -> ResourceSummaryDict:
    """Combine task assignees with logged hours for resource section fields."""
    tasks = task_service.get_tasks_by_project(project_id)
    assignee_counts: dict[str, int] = {}
    for t in tasks:
        uid = t.get("assignee_id")
        if not uid:
            continue
        assignee_counts[uid] = assignee_counts.get(uid, 0) + 1

    team_members = sorted(assignee_counts.keys())
    total_by_user = log_service.get_hours_logged_by_user(project_id)
    if team_members:
        total_hours = float(sum(total_by_user.get(uid, 0.0) for uid in team_members))
    else:
        total_hours = None

    task_distribution: dict[str, float] = {}
    total_tasks = sum(assignee_counts.values()) or 0
    if total_tasks:
        for uid, cnt in assignee_counts.items():
            task_distribution[uid] = round(100.0 * cnt / total_tasks, 1)

    return ResourceSummaryDict(
        team_members=team_members,
        total_hours=total_hours,
        task_distribution=task_distribution,
    )


def get_quality_summary(project_id: str | int) -> QualitySummaryDict:
    """Normalize inspection rollups to quality section fields."""
    roll = inspection_service.get_inspection_rollups(project_id)
    return QualitySummaryDict(
        inspections_passed=int(roll.get("passed", 0)),
        inspections_failed=int(roll.get("failed", 0)),
        rework_count=int(roll.get("rework_events", 0)),
    )


def get_communication_summary(project_id: str | int) -> CommunicationSummaryDict:
    """Normalize log-derived comms stats to communication section fields."""
    roll = log_service.get_communication_rollups(project_id)
    return CommunicationSummaryDict(
        update_count=int(roll.get("update_count", 0)),
        avg_response_time=roll.get("avg_response_time_hours"),
    )


def overview_section(m: MockProjectMetrics) -> SummaryOverview:
    start = date(2025, 1, 1) + timedelta(days=m.project_id % 120)
    planned_days = 60 + (m.project_id % 45)
    end = start + timedelta(days=planned_days)
    success: bool | None = True if m.completion_pct >= 90 else (False if m.completion_pct < 45 else None)
    return SummaryOverview(
        project_name=f"Mock Project {m.project_id}",
        project_type="Capital" if m.project_id % 2 == 0 else "Operational",
        start_date=start,
        end_date=end,
        owner=f"owner-user-{m.project_id % 10}",
        success_flag=success,
    )


def risks_section(m: MockProjectMetrics) -> SummaryRisks:
    majors: list[str] = []
    if m.open_risk_count >= 3:
        majors.append("Vendor lead time slip (mock)")
    if m.completion_pct < 50:
        majors.append("Resource contention (mock)")
    return SummaryRisks(issue_count=m.open_risk_count + 2, major_issues=majors)


def stakeholders_section(m: MockProjectMetrics) -> SummaryStakeholders:
    score = 7.0 + (m.project_id % 4) * 0.5 if m.stakeholder_count > 0 else None
    return SummaryStakeholders(satisfaction_score=score)


def lessons_section() -> SummaryLessons:
    return SummaryLessons(went_well="", didnt_go_well="", improvements="")


def outcome_section(m: MockProjectMetrics) -> SummaryOutcome:
    result: OutcomeResult
    if m.completion_pct >= 85:
        result = "success"
    elif m.completion_pct >= 50:
        result = "partial"
    else:
        result = "fail"
    return SummaryOutcome(result=result, summary="")


__all__ = [
    "CommunicationSummaryDict",
    "QualitySummaryDict",
    "ResourceSummaryDict",
    "ScheduleSummaryDict",
    "TaskSummaryDict",
    "get_communication_summary",
    "get_quality_summary",
    "get_resource_summary",
    "get_schedule_summary",
    "get_task_summary",
    "lessons_section",
    "outcome_section",
    "overview_section",
    "risks_section",
    "stakeholders_section",
]
