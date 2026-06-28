"""Validate CAPM / training JSON import packs before persistence."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import ValidationError

from app.schemas.training_platform import (
    TrainingImportCourseIn,
    TrainingImportFlashcardIn,
    TrainingImportPackIn,
    TrainingImportSectionIn,
)

ImportIssueSeverity = Literal["error", "warning"]
ImportIssueCode = Literal[
    "invalid_json",
    "schema_error",
    "missing_field",
    "duplicate_id",
    "duplicate_question",
    "duplicate_answer",
    "duplicate_slug",
    "missing_explanation",
    "missing_tags",
    "invalid_difficulty",
    "empty_section",
]


@dataclass
class ImportIssue:
    severity: ImportIssueSeverity
    code: ImportIssueCode
    path: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "path": self.path,
            "message": self.message,
        }


@dataclass
class ImportValidationResult:
    pack: TrainingImportPackIn | None = None
    errors: list[ImportIssue] = field(default_factory=list)
    warnings: list[ImportIssue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0 and self.pack is not None


class TrainingImportValidationError(Exception):
    """Raised when import pack fails validation; carries structured issues."""

    def __init__(self, result: ImportValidationResult) -> None:
        self.result = result
        super().__init__(f"Import validation failed with {len(result.errors)} error(s)")


def _norm_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def _missing(value: str | None) -> bool:
    return not value or not str(value).strip()


def parse_import_pack_json(raw: str | bytes) -> ImportValidationResult:
    """Parse raw JSON and apply Pydantic schema validation."""
    result = ImportValidationResult()
    try:
        text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        result.errors.append(
            ImportIssue("error", "invalid_json", "$", f"Invalid JSON: {exc.msg}")
        )
        return result
    except UnicodeDecodeError as exc:
        result.errors.append(
            ImportIssue("error", "invalid_json", "$", f"Invalid UTF-8: {exc}")
        )
        return result

    if not isinstance(data, dict):
        result.errors.append(
            ImportIssue("error", "invalid_json", "$", "Import document must be a JSON object")
        )
        return result

    try:
        pack = TrainingImportPackIn.model_validate(data)
    except ValidationError as exc:
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()))
            result.errors.append(
                ImportIssue(
                    "error",
                    "schema_error",
                    loc or "$",
                    str(err.get("msg", "Schema validation failed")),
                )
            )
        return result

    result.pack = pack
    return validate_import_pack_complete(pack)


def validate_import_pack_complete(pack: TrainingImportPackIn) -> ImportValidationResult:
    """Structural + per-section + global flashcard id validation."""
    result = ImportValidationResult(pack=pack)
    global_ids: dict[str, str] = {}
    course_slugs: dict[str, str] = {}

    if _missing(pack.source_name):
        result.errors.append(
            ImportIssue("error", "missing_field", "source_name", "source_name is required")
        )

    if not pack.courses:
        result.errors.append(
            ImportIssue("error", "missing_field", "courses", "At least one course is required")
        )

    for ci, course in enumerate(pack.courses):
        _validate_course(result, course, ci, course_slugs, global_ids)

    return result


def _validate_course(
    result: ImportValidationResult,
    course: TrainingImportCourseIn,
    ci: int,
    course_slugs: dict[str, str],
    global_ids: dict[str, str],
) -> None:
    cpath = f"courses[{ci}]"
    if _missing(course.slug):
        result.errors.append(
            ImportIssue("error", "missing_field", f"{cpath}.slug", "Course slug is required")
        )
    if _missing(course.title):
        result.errors.append(
            ImportIssue("error", "missing_field", f"{cpath}.title", "Course title is required")
        )
    if course.slug and course.slug in course_slugs:
        result.errors.append(
            ImportIssue(
                "error",
                "duplicate_slug",
                f"{cpath}.slug",
                f"Duplicate course slug {course.slug!r} (first at {course_slugs[course.slug]})",
            )
        )
    elif course.slug:
        course_slugs[course.slug] = cpath

    if not course.sections and not course.flashcards:
        result.warnings.append(
            ImportIssue(
                "warning",
                "missing_field",
                cpath,
                "Course has no sections or course-level flashcards",
            )
        )

    section_slugs: dict[str, str] = {}
    for si, section in enumerate(course.sections):
        spath = f"{cpath}.sections[{si}]"
        if _missing(section.slug):
            result.errors.append(
                ImportIssue("error", "missing_field", f"{spath}.slug", "Section slug is required")
            )
        if _missing(section.title):
            result.errors.append(
                ImportIssue("error", "missing_field", f"{spath}.title", "Section title is required")
            )
        if section.slug and section.slug in section_slugs:
            result.errors.append(
                ImportIssue(
                    "error",
                    "duplicate_slug",
                    f"{spath}.slug",
                    f"Duplicate section slug {section.slug!r} (first at {section_slugs[section.slug]})",
                )
            )
        elif section.slug:
            section_slugs[section.slug] = spath

        _validate_section_cards(result, spath, _collect_section_flashcards(section, spath), global_ids)

    if course.flashcards:
        _validate_section_cards(
            result,
            f"{cpath}.__course__",
            [(f"{cpath}.flashcards[{fi}]", fc) for fi, fc in enumerate(course.flashcards)],
            global_ids,
        )


def _collect_section_flashcards(
    section: TrainingImportSectionIn,
    spath: str,
) -> list[tuple[str, TrainingImportFlashcardIn]]:
    out: list[tuple[str, TrainingImportFlashcardIn]] = []
    for fi, card in enumerate(section.flashcards):
        out.append((f"{spath}.flashcards[{fi}]", card))
    for li, lesson in enumerate(section.lessons):
        lpath = f"{spath}.lessons[{li}]"
        for fi, card in enumerate(lesson.flashcards):
            out.append((f"{lpath}.flashcards[{fi}]", card))
    return out


def _validate_section_cards(
    result: ImportValidationResult,
    section_path: str,
    cards: list[tuple[str, TrainingImportFlashcardIn]],
    global_ids: dict[str, str],
) -> None:
    questions: dict[str, str] = {}
    answers: dict[str, str] = {}

    for fpath, card in cards:
        if _missing(card.prompt):
            result.errors.append(
                ImportIssue("error", "missing_field", f"{fpath}.prompt", "Flashcard prompt is required")
            )
        if _missing(card.answer):
            result.errors.append(
                ImportIssue("error", "missing_field", f"{fpath}.answer", "Flashcard answer is required")
            )

        if card.id:
            ext_id = card.id.strip()
            if _missing(ext_id):
                result.errors.append(
                    ImportIssue("error", "missing_field", f"{fpath}.id", "Flashcard id cannot be blank")
                )
            elif ext_id in global_ids:
                result.errors.append(
                    ImportIssue(
                        "error",
                        "duplicate_id",
                        fpath,
                        f"Duplicate flashcard id {ext_id!r} (first at {global_ids[ext_id]})",
                    )
                )
            else:
                global_ids[ext_id] = fpath

        prompt_key = _norm_text(card.prompt)
        if prompt_key:
            if prompt_key in questions:
                result.errors.append(
                    ImportIssue(
                        "error",
                        "duplicate_question",
                        fpath,
                        f"Duplicate question in section (matches {questions[prompt_key]})",
                    )
                )
            else:
                questions[prompt_key] = fpath

        answer_key = _norm_text(card.answer)
        if answer_key:
            if answer_key in answers:
                result.errors.append(
                    ImportIssue(
                        "error",
                        "duplicate_answer",
                        fpath,
                        f"Duplicate answer in section (matches {answers[answer_key]})",
                    )
                )
            else:
                answers[answer_key] = fpath


def ensure_valid_import_pack(pack: TrainingImportPackIn) -> ImportValidationResult:
    result = validate_import_pack_complete(pack)
    if not result.ok:
        raise TrainingImportValidationError(result)
    return result
