"""Developer deck validation — read-only quality checks and statistics (no data mutation)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.schemas.training_platform import TrainingImportPackIn
from app.services.training_platform.import_validation import (
    ImportIssue,
    ImportValidationResult,
    _collect_section_flashcards,
    _missing,
    parse_import_pack_json,
)

MIN_FLASHCARD_DIFFICULTY = 1
MAX_FLASHCARD_DIFFICULTY = 5


@dataclass
class DeckValidationStatistics:
    courses: int = 0
    sections: int = 0
    flashcards: int = 0
    flashcards_with_explanation: int = 0
    flashcards_with_tags: int = 0
    flashcards_missing_explanation: int = 0
    flashcards_missing_tags: int = 0
    sections_without_cards: int = 0
    invalid_difficulty_count: int = 0
    duplicate_questions: int = 0
    duplicate_answers: int = 0
    by_difficulty: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "courses": self.courses,
            "sections": self.sections,
            "flashcards": self.flashcards,
            "flashcards_with_explanation": self.flashcards_with_explanation,
            "flashcards_with_tags": self.flashcards_with_tags,
            "flashcards_missing_explanation": self.flashcards_missing_explanation,
            "flashcards_missing_tags": self.flashcards_missing_tags,
            "sections_without_cards": self.sections_without_cards,
            "invalid_difficulty_count": self.invalid_difficulty_count,
            "duplicate_questions": self.duplicate_questions,
            "duplicate_answers": self.duplicate_answers,
            "by_difficulty": dict(self.by_difficulty),
        }


@dataclass
class DeckValidationReport:
    source_name: str | None = None
    version: str | None = None
    errors: list[ImportIssue] = field(default_factory=list)
    warnings: list[ImportIssue] = field(default_factory=list)
    statistics: DeckValidationStatistics = field(default_factory=DeckValidationStatistics)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    @property
    def status(self) -> str:
        return "valid" if self.ok else "invalid"

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_name": self.source_name,
            "version": self.version,
            "status": self.status,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "statistics": self.statistics.to_dict(),
        }


def validate_deck_pack(raw: str | bytes) -> DeckValidationReport:
    """Validate a deck JSON document; never modifies the source data."""
    base = parse_import_pack_json(raw)
    report = DeckValidationReport(
        source_name=base.pack.source_name if base.pack else None,
        version=base.pack.version if base.pack else None,
        errors=list(base.errors),
        warnings=list(base.warnings),
    )
    if base.pack is not None:
        _apply_developer_quality_checks(report, base.pack)
        report.statistics = _compute_statistics(report, base.pack)
    else:
        report.statistics = _empty_statistics_from_issues(report)
    return report


def validate_deck_pack_from_dict(data: dict[str, Any]) -> DeckValidationReport:
    return validate_deck_pack(json.dumps(data))


def _apply_developer_quality_checks(report: DeckValidationReport, pack: TrainingImportPackIn) -> None:
    for ci, course in enumerate(pack.courses):
        cpath = f"courses[{ci}]"
        for si, section in enumerate(course.sections):
            spath = f"{cpath}.sections[{si}]"
            cards = _collect_section_flashcards(section, spath)
            if len(cards) == 0:
                report.warnings.append(
                    ImportIssue(
                        "warning",
                        "empty_section",
                        spath,
                        f"Section {section.slug!r} has no flashcards",
                    )
                )
            for fpath, card in cards:
                _check_card_quality(report, fpath, card)

        for fi, card in enumerate(course.flashcards):
            _check_card_quality(report, f"{cpath}.flashcards[{fi}]", card)


def _check_card_quality(report: DeckValidationReport, fpath: str, card: Any) -> None:
    if _missing(card.explanation):
        report.warnings.append(
            ImportIssue(
                "warning",
                "missing_explanation",
                fpath,
                "Flashcard has no explanation",
            )
        )

    if not card.tags:
        report.warnings.append(
            ImportIssue(
                "warning",
                "missing_tags",
                fpath,
                "Flashcard has no tags",
            )
        )

    difficulty = int(card.difficulty if card.difficulty is not None else 3)
    if difficulty < MIN_FLASHCARD_DIFFICULTY or difficulty > MAX_FLASHCARD_DIFFICULTY:
        report.errors.append(
            ImportIssue(
                "error",
                "invalid_difficulty",
                f"{fpath}.difficulty",
                f"Difficulty {difficulty} is outside allowed range "
                f"{MIN_FLASHCARD_DIFFICULTY}–{MAX_FLASHCARD_DIFFICULTY}",
            )
        )


def _compute_statistics(report: DeckValidationReport, pack: TrainingImportPackIn) -> DeckValidationStatistics:
    stats = DeckValidationStatistics()
    stats.courses = len(pack.courses)
    stats.duplicate_questions = sum(1 for e in report.errors if e.code == "duplicate_question")
    stats.duplicate_answers = sum(1 for e in report.errors if e.code == "duplicate_answer")

    for course in pack.courses:
        for section in course.sections:
            stats.sections += 1
            cards = _collect_section_flashcards(section, "")
            if not cards:
                stats.sections_without_cards += 1
            for _, card in cards:
                _tally_card(stats, card)

        for card in course.flashcards:
            _tally_card(stats, card)

    stats.flashcards_missing_explanation = sum(
        1 for w in report.warnings if w.code == "missing_explanation"
    )
    stats.flashcards_missing_tags = sum(1 for w in report.warnings if w.code == "missing_tags")
    stats.invalid_difficulty_count = sum(1 for e in report.errors if e.code == "invalid_difficulty")
    return stats


def _tally_card(stats: DeckValidationStatistics, card: Any) -> None:
    stats.flashcards += 1
    if not _missing(card.explanation):
        stats.flashcards_with_explanation += 1
    if card.tags:
        stats.flashcards_with_tags += 1
    difficulty = str(int(card.difficulty if card.difficulty is not None else 3))
    stats.by_difficulty[difficulty] = stats.by_difficulty.get(difficulty, 0) + 1


def _empty_statistics_from_issues(report: DeckValidationReport) -> DeckValidationStatistics:
    stats = DeckValidationStatistics()
    stats.duplicate_questions = sum(1 for e in report.errors if e.code == "duplicate_question")
    stats.duplicate_answers = sum(1 for e in report.errors if e.code == "duplicate_answer")
    stats.invalid_difficulty_count = sum(1 for e in report.errors if e.code == "invalid_difficulty")
    return stats


def report_from_validation_result(result: ImportValidationResult) -> DeckValidationReport:
    """Build a developer report from an existing validation result."""
    if result.pack is None:
        return DeckValidationReport(
            errors=list(result.errors),
            warnings=list(result.warnings),
            statistics=_empty_statistics_from_issues(
                DeckValidationReport(errors=list(result.errors), warnings=list(result.warnings))
            ),
        )
    raw = result.pack.model_dump_json()
    return validate_deck_pack(raw)
