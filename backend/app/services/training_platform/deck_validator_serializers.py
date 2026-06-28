"""Convert deck validation report to API schema."""

from __future__ import annotations

from app.schemas.training_platform import (
    TrainingDeckValidationReportOut,
    TrainingDeckValidationStatsOut,
    TrainingImportIssueOut,
)
from app.services.training_platform.deck_validator import DeckValidationReport


def deck_validation_report_out(report: DeckValidationReport) -> TrainingDeckValidationReportOut:
    return TrainingDeckValidationReportOut(
        source_name=report.source_name,
        version=report.version,
        status="valid" if report.ok else "invalid",
        errors=[TrainingImportIssueOut(**e.to_dict()) for e in report.errors],
        warnings=[TrainingImportIssueOut(**w.to_dict()) for w in report.warnings],
        statistics=TrainingDeckValidationStatsOut(**report.statistics.to_dict()),
    )
