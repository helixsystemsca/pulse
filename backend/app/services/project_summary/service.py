"""Orchestrate project summary generation (aggregators + metrics + assembly).

Persisted drafts store ``snapshot_json`` as versioned **raw aggregates** (``v`` +
``aggregates``) and ``metrics_json`` as the KPI blob computed once at save time.
Reads from storage must use :func:`rehydrate_project_summary` so historical rows
stay immutable (no live aggregator calls).
"""

from __future__ import annotations

from typing import Any

from app.services.project_summary import aggregators
from app.services.project_summary.metrics import (
    calculate_completion_rate,
    calculate_inspection_pass_rate,
    calculate_schedule_variance,
    mock_metrics_for_project,
    project_seed_int,
)
from app.services.project_summary.schemas import (
    OutcomeResult,
    ProjectSummary,
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

SNAPSHOT_FORMAT_VERSION = 1


def _merge_schedule_variance(schedule_payload: aggregators.ScheduleSummaryDict) -> dict[str, Any]:
    """Align ``variance_days`` with the metrics layer when actual duration is known."""
    row = dict(schedule_payload)
    planned = int(row.get("planned_duration_days", 0))
    actual = row.get("actual_duration_days")
    if actual is not None:
        row["variance_days"] = calculate_schedule_variance(planned, int(actual))
    return row


def _success_flag_from_metrics(
    completion_rate_pct: float,
    inspection_pass_rate_pct: float | None,
) -> bool | None:
    """Map aggregate completion and inspection health to a coarse success signal."""
    if completion_rate_pct >= 90.0 and (
        inspection_pass_rate_pct is None or inspection_pass_rate_pct >= 80.0
    ):
        return True
    if completion_rate_pct < 45.0:
        return False
    if inspection_pass_rate_pct is not None and inspection_pass_rate_pct < 50.0:
        return False
    return None


def _empty_lessons() -> SummaryLessons:
    return SummaryLessons(went_well="", didnt_go_well="", improvements="")


def _empty_outcome() -> SummaryOutcome:
    """Schema requires ``result``; use a neutral value until outcome is captured."""
    neutral: OutcomeResult = "partial"
    return SummaryOutcome(result=neutral, summary="")


def collect_raw_aggregates(project_id: str | int) -> dict[str, Any]:
    """Single pass over aggregators + deterministic seed sections (no DB)."""
    seed_int = project_seed_int(project_id)
    seed = mock_metrics_for_project(seed_int)
    schedule_raw = aggregators.get_schedule_summary(project_id)
    return {
        "task": dict(aggregators.get_task_summary(project_id)),
        "schedule": _merge_schedule_variance(schedule_raw),
        "resources": dict(aggregators.get_resource_summary(project_id)),
        "quality": dict(aggregators.get_quality_summary(project_id)),
        "communication": dict(aggregators.get_communication_summary(project_id)),
        "overview_base": aggregators.overview_section(seed).model_dump(mode="json"),
        "risks": aggregators.risks_section(seed).model_dump(mode="json"),
        "stakeholders": aggregators.stakeholders_section(seed).model_dump(mode="json"),
    }


def build_metrics_json_from_aggregates(aggregates: dict[str, Any]) -> dict[str, Any]:
    """Derive persisted KPIs from a frozen aggregate bundle (no aggregator calls)."""
    task_payload = aggregates["task"]
    quality_payload = aggregates["quality"]
    schedule_payload = aggregates["schedule"]

    completion_rate_pct = calculate_completion_rate(
        int(task_payload["planned_tasks"]),
        int(task_payload["completed_tasks"]),
    )
    inspection_total = int(quality_payload["inspections_passed"]) + int(quality_payload["inspections_failed"])
    inspection_pass_rate_pct = (
        calculate_inspection_pass_rate(
            int(quality_payload["inspections_passed"]),
            int(quality_payload["inspections_failed"]),
        )
        if inspection_total
        else None
    )

    sched_variance: int | None = None
    act = schedule_payload.get("actual_duration_days")
    if act is not None:
        sched_variance = calculate_schedule_variance(
            int(schedule_payload["planned_duration_days"]),
            int(act),
        )

    return {
        "completion_rate_pct": completion_rate_pct,
        "inspection_pass_rate_pct": inspection_pass_rate_pct,
        "schedule_variance_days": sched_variance,
        "delayed_tasks": int(schedule_payload.get("delayed_tasks", 0)),
    }


def build_metrics_json(project_id: str | int) -> dict[str, Any]:
    """Roll up KPIs for ``metrics_json`` (one aggregate pass)."""
    return build_metrics_json_from_aggregates(collect_raw_aggregates(project_id))


def assemble_project_summary(
    project_id_str: str,
    aggregates: dict[str, Any],
    metrics_json: dict[str, Any],
) -> ProjectSummary:
    """Build ``ProjectSummary`` from frozen aggregates + frozen metrics (no aggregator calls)."""
    task_payload = aggregates["task"]
    schedule_row = aggregates["schedule"]
    resource_payload = aggregates["resources"]
    quality_payload = aggregates["quality"]
    communication_payload = aggregates["communication"]

    completion_rate_pct = float(metrics_json["completion_rate_pct"])
    raw_ip = metrics_json.get("inspection_pass_rate_pct")
    inspection_pass_rate_pct = float(raw_ip) if raw_ip is not None else None

    overview = SummaryOverview.model_validate(
        {
            **aggregates["overview_base"],
            "success_flag": _success_flag_from_metrics(
                completion_rate_pct,
                inspection_pass_rate_pct,
            ),
        }
    )

    return ProjectSummary(
        project_id=project_id_str,
        overview=overview,
        scope=SummaryScope(**task_payload),
        schedule=SummarySchedule(**schedule_row),
        resources=SummaryResources(**resource_payload),
        quality=SummaryQuality(**quality_payload),
        risks=SummaryRisks.model_validate(aggregates["risks"]),
        communication=SummaryCommunication(**communication_payload),
        stakeholders=SummaryStakeholders.model_validate(aggregates["stakeholders"]),
        lessons=_empty_lessons(),
        outcome=_empty_outcome(),
    )


def rehydrate_project_summary(
    project_id: str,
    snapshot_json: dict[str, Any],
    metrics_json: dict[str, Any],
) -> ProjectSummary:
    """Reconstruct ``ProjectSummary`` from persisted rows only (no live aggregation)."""
    snap = dict(snapshot_json or {})
    metrics = dict(metrics_json or {})

    if snap.get("v") == SNAPSHOT_FORMAT_VERSION and "aggregates" in snap:
        return assemble_project_summary(project_id, dict(snap["aggregates"]), metrics)

    # Legacy: full envelope stored as the entire snapshot_json.
    if "overview" in snap and "project_id" in snap:
        return ProjectSummary.model_validate(snap)

    raise ValueError("unrecognized_snapshot_json_shape")


def _build_live_document(project_id: str | int) -> tuple[dict[str, Any], dict[str, Any], ProjectSummary]:
    """One aggregate pass: raw bundles, metrics, and assembled document."""
    pid_str = str(project_id)
    aggregates = collect_raw_aggregates(project_id)
    metrics = build_metrics_json_from_aggregates(aggregates)
    doc = assemble_project_summary(pid_str, aggregates, metrics)
    return aggregates, metrics, doc


def persistable_snapshot_bundle(
    project_id: str | int,
) -> tuple[dict[str, Any], dict[str, Any], ProjectSummary]:
    """One aggregate pass: frozen snapshot for DB, metrics, and assembled document for responses."""
    aggregates, metrics, doc = _build_live_document(project_id)
    snapshot_json = {"v": SNAPSHOT_FORMAT_VERSION, "aggregates": aggregates}
    return snapshot_json, metrics, doc


def generate_project_summary(project_id: str | int) -> ProjectSummary:
    """Build a live ``ProjectSummary`` (single aggregate pass; not read from storage)."""
    return _build_live_document(project_id)[2]
