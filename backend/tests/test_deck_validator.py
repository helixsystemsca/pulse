"""Tests for developer deck validation utility."""

from __future__ import annotations

import json

from app.services.training_platform.deck_validator import validate_deck_pack


def _pack(**overrides) -> dict:
    base = {
        "version": "2.0",
        "source_name": "dev-check",
        "courses": [
            {
                "slug": "capm",
                "title": "CAPM",
                "sections": [
                    {
                        "slug": "ch1",
                        "title": "Chapter 1",
                        "flashcards": [
                            {
                                "id": "fc-1",
                                "prompt": "What is a project?",
                                "answer": "Temporary endeavor",
                                "explanation": "PMBOK definition",
                                "difficulty": 3,
                                "tags": ["integration"],
                            }
                        ],
                    },
                    {
                        "slug": "empty",
                        "title": "Empty section",
                        "flashcards": [],
                    },
                ],
            }
        ],
    }
    base.update(overrides)
    return base


def test_valid_deck_statistics() -> None:
    report = validate_deck_pack(json.dumps(_pack()))
    assert report.statistics.courses == 1
    assert report.statistics.sections == 2
    assert report.statistics.flashcards == 1
    assert report.statistics.flashcards_with_explanation == 1
    assert report.statistics.sections_without_cards == 1
    assert any(w.code == "empty_section" for w in report.warnings)


def test_warnings_for_missing_explanation_and_tags() -> None:
    data = _pack()
    data["courses"][0]["sections"][0]["flashcards"] = [
        {"id": "fc-1", "prompt": "Q?", "answer": "A", "difficulty": 3, "tags": []}
    ]
    report = validate_deck_pack(json.dumps(data))
    assert any(w.code == "missing_explanation" for w in report.warnings)
    assert any(w.code == "missing_tags" for w in report.warnings)
    assert report.statistics.flashcards_missing_explanation == 1
    assert report.statistics.flashcards_missing_tags == 1


def test_error_for_invalid_difficulty() -> None:
    data = _pack()
    data["courses"][0]["sections"][0]["flashcards"][0]["difficulty"] = 9
    report = validate_deck_pack(json.dumps(data))
    assert not report.ok
    assert any(e.code == "invalid_difficulty" for e in report.errors)
    assert report.statistics.invalid_difficulty_count == 1


def test_duplicate_question_error_in_report() -> None:
    data = _pack()
    data["courses"][0]["sections"][0]["flashcards"].append(
        {
            "id": "fc-2",
            "prompt": "What is a project?",
            "answer": "Other",
            "explanation": "x",
            "tags": ["t"],
            "difficulty": 2,
        }
    )
    report = validate_deck_pack(json.dumps(data))
    assert not report.ok
    assert report.statistics.duplicate_questions == 1
    assert any(e.code == "duplicate_question" for e in report.errors)


def test_does_not_mutate_source() -> None:
    data = _pack()
    original = json.dumps(data)
    validate_deck_pack(original)
    assert json.dumps(data) == original
