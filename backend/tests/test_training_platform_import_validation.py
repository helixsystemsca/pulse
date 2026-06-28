"""Unit tests for training import validation (no database)."""

from __future__ import annotations

import json

import pytest

from app.schemas.training_platform import TrainingImportPackIn
from app.services.training_platform.import_validation import (
    TrainingImportValidationError,
    ensure_valid_import_pack,
    parse_import_pack_json,
    validate_import_pack_complete,
)


def _minimal_pack(**overrides) -> dict:
    base = {
        "version": "1.0",
        "source_name": "capm-test",
        "courses": [
            {
                "slug": "capm",
                "title": "CAPM",
                "sections": [
                    {
                        "slug": "ch1",
                        "title": "Chapter 1",
                        "flashcards": [
                            {"id": "fc-1", "prompt": "What is a project?", "answer": "Temporary endeavor"},
                        ],
                    }
                ],
            }
        ],
    }
    base.update(overrides)
    return base


def test_rejects_invalid_json() -> None:
    result = parse_import_pack_json("{not json")
    assert not result.ok
    assert any(e.code == "invalid_json" for e in result.errors)


def test_rejects_non_object_root() -> None:
    result = parse_import_pack_json("[1, 2]")
    assert not result.ok
    assert any("JSON object" in e.message for e in result.errors)


def test_rejects_missing_source_name() -> None:
    pack = TrainingImportPackIn.model_validate({**_minimal_pack(), "source_name": "  "})
    result = validate_import_pack_complete(pack)
    assert any(e.code == "missing_field" and e.path == "source_name" for e in result.errors)


def test_rejects_empty_courses() -> None:
    pack = TrainingImportPackIn.model_validate({**_minimal_pack(), "courses": []})
    result = validate_import_pack_complete(pack)
    assert any(e.path == "courses" for e in result.errors)


def test_reports_duplicate_question_in_section() -> None:
    data = _minimal_pack()
    data["courses"][0]["sections"][0]["flashcards"].append(
        {"id": "fc-2", "prompt": "What is a project?", "answer": "Different answer"}
    )
    result = parse_import_pack_json(json.dumps(data))
    assert not result.ok
    assert any(e.code == "duplicate_question" for e in result.errors)


def test_reports_duplicate_answer_in_section() -> None:
    data = _minimal_pack()
    data["courses"][0]["sections"][0]["flashcards"].append(
        {"id": "fc-2", "prompt": "Another question?", "answer": "Temporary endeavor"}
    )
    result = parse_import_pack_json(json.dumps(data))
    assert not result.ok
    assert any(e.code == "duplicate_answer" for e in result.errors)


def test_reports_duplicate_flashcard_id_globally() -> None:
    data = _minimal_pack()
    data["courses"][0]["sections"][0]["flashcards"].append(
        {"id": "fc-1", "prompt": "Unique Q", "answer": "Unique A"}
    )
    result = parse_import_pack_json(json.dumps(data))
    assert not result.ok
    assert any(e.code == "duplicate_id" for e in result.errors)


def test_reports_missing_flashcard_fields() -> None:
    data = _minimal_pack()
    data["courses"][0]["sections"][0]["flashcards"] = [{"id": "x", "prompt": "", "answer": ""}]
    result = parse_import_pack_json(json.dumps(data))
    assert not result.ok
    codes = {e.code for e in result.errors}
    assert "missing_field" in codes


def test_accepts_section_level_flashcards() -> None:
    result = parse_import_pack_json(json.dumps(_minimal_pack()))
    assert result.ok
    ensure_valid_import_pack(result.pack)  # type: ignore[arg-type]


def test_duplicate_questions_span_lessons_within_section() -> None:
    data = _minimal_pack()
    data["courses"][0]["sections"][0]["lessons"] = [
        {
            "slug": "l1",
            "title": "Lesson 1",
            "flashcards": [{"id": "fc-2", "prompt": "What is a project?", "answer": "From lesson"}],
        }
    ]
    result = parse_import_pack_json(json.dumps(data))
    assert not result.ok
    assert any(e.code == "duplicate_question" for e in result.errors)


def test_ensure_valid_raises() -> None:
    pack = TrainingImportPackIn.model_validate({**_minimal_pack(), "courses": []})
    with pytest.raises(TrainingImportValidationError):
        ensure_valid_import_pack(pack)
