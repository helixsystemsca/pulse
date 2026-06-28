"""CAPM empty course shell — structure only, no flashcards."""

from __future__ import annotations

import json
from pathlib import Path

from app.services.training_platform.deck_validator import validate_deck_pack
from app.services.training_platform.import_validation import parse_import_pack_json

PACK_PATH = Path(__file__).resolve().parents[1] / "data" / "training" / "capm-course-shell.json"

EXPECTED_SECTION_SLUGS = [
    "project-fundamentals",
    "delivery-approaches",
    "eefs-opas",
    "pmo",
    "tailoring",
    "project-manager",
    "leadership",
    "governance",
    "stakeholders",
    "scope",
    "schedule",
    "finance",
    "resources",
    "risk",
]


def test_capm_shell_pack_loads_and_validates() -> None:
    raw = PACK_PATH.read_text(encoding="utf-8")
    result = parse_import_pack_json(raw)
    assert result.ok, [e.message for e in result.errors]
    assert result.pack is not None
    assert result.pack.source_name == "capm-course-shell"

    course = result.pack.courses[0]
    assert course.slug == "capm"
    assert course.title == "CAPM"
    assert course.certification_slug == "capm"
    assert len(course.sections) == 14
    assert [s.slug for s in course.sections] == EXPECTED_SECTION_SLUGS
    assert all(len(s.flashcards) == 0 for s in course.sections)
    assert all(len(s.lessons) == 0 for s in course.sections)
    assert len(course.flashcards) == 0


def test_capm_shell_passes_import_with_empty_section_warnings_only() -> None:
    raw = PACK_PATH.read_text(encoding="utf-8")
    report = validate_deck_pack(raw)
    assert len(report.errors) == 0
    assert report.statistics.courses == 1
    assert report.statistics.sections == 14
    assert report.statistics.flashcards == 0
    assert report.statistics.sections_without_cards == 14
    assert all(w.code == "empty_section" for w in report.warnings)


def test_capm_shell_json_round_trip() -> None:
    data = json.loads(PACK_PATH.read_text(encoding="utf-8"))
    assert data["certifications"][0]["slug"] == "capm"
    assert len(data["courses"][0]["sections"]) == 14
