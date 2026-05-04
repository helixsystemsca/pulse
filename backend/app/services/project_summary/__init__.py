"""Project summary service (skeleton; mock-backed)."""

from app.services.project_summary.formatting import format_project_summary
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
from app.services.project_summary.service import (
    generate_project_summary,
    persistable_snapshot_bundle,
    rehydrate_project_summary,
)

__all__ = [
    "OutcomeResult",
    "format_project_summary",
    "ProjectSummary",
    "SummaryCommunication",
    "SummaryLessons",
    "SummaryOutcome",
    "SummaryOverview",
    "SummaryQuality",
    "SummaryResources",
    "SummaryRisks",
    "SummarySchedule",
    "SummaryScope",
    "SummaryStakeholders",
    "generate_project_summary",
    "persistable_snapshot_bundle",
    "rehydrate_project_summary",
]
