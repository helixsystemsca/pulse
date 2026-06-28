"""Normalize flashcard / study card types and option field aliases (backwards compatible)."""

from __future__ import annotations

import re
from typing import Any

# Canonical study types for the mixed-question platform.
CANONICAL_STUDY_TYPES = frozenset(
    {"flashcard", "mcq", "tf", "scenario", "comparison", "fill_blank"}
)

# Legacy importer + DB values map to canonical study_type (API field).
_CARD_TYPE_ALIASES: dict[str, str] = {
    "flashcard": "flashcard",
    "definition": "flashcard",
    "recall": "flashcard",
    "matching": "flashcard",
    "ordering": "flashcard",
    "multiple_choice": "mcq",
    "mcq": "mcq",
    "true_false": "tf",
    "tf": "tf",
    "scenario": "scenario",
    "comparison": "comparison",
    "fill_blank": "fill_blank",
}

_OPTION_FIELD_ALIASES: dict[str, str] = {
    "choices": "choices",
    "correctAnswer": "correct_index",
    "correct_answer": "correct_index",
    "correct_index": "correct_index",
    "statement": "statement",
    "isTrue": "is_true",
    "is_true": "is_true",
    "comparisonLeft": "comparison_left",
    "comparison_left": "comparison_left",
    "comparisonRight": "comparison_right",
    "comparison_right": "comparison_right",
    "blankAnswer": "blank_answer",
    "blank_answer": "blank_answer",
    "hint": "hint",
    "references": "references",
    "relatedCards": "related_cards",
    "related_cards": "related_cards",
}


def normalize_study_type(card_type: str | None) -> str:
    raw = (card_type or "flashcard").strip().lower()
    return _CARD_TYPE_ALIASES.get(raw, "flashcard")


def merge_flashcard_option_fields(
    options: dict[str, Any] | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge options JSON with top-level import aliases into a stable storage shape."""
    merged: dict[str, Any] = dict(options or {})
    for source in (extra or {}).items():
        key, value = source
        if value is None:
            continue
        canonical = _OPTION_FIELD_ALIASES.get(key, key)
        if canonical not in merged or merged[canonical] in (None, "", []):
            merged[canonical] = value
    return merged


def coerce_import_flashcard_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw import flashcard object before schema validation."""
    row = dict(data)
    if row.get("question") and not row.get("prompt"):
        row["prompt"] = row["question"]
    if row.get("type") and not row.get("card_type"):
        row["card_type"] = row["type"]

    top_level_option_keys = set(_OPTION_FIELD_ALIASES) | {"choices"}
    extra: dict[str, Any] = {}
    for key in list(row.keys()):
        if key in top_level_option_keys:
            extra[key] = row.pop(key)

    row["options"] = merge_flashcard_option_fields(row.get("options"), extra)
    return row


def normalize_answer_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())
