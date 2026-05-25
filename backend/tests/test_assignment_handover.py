"""Assignment handover note types and resolution defaults."""

from app.services.assignment_handover import (
    HANDOVER_NOTE_TYPES,
    OPEN_HANDOVER_NOTE_TYPES,
    handover_defaults_resolved,
)


def test_handover_note_types_complete():
    assert "informational" in HANDOVER_NOTE_TYPES
    assert "safety_concern" in HANDOVER_NOTE_TYPES


def test_open_types_exclude_informational():
    assert "informational" not in OPEN_HANDOVER_NOTE_TYPES
    assert "follow_up_required" in OPEN_HANDOVER_NOTE_TYPES


def test_informational_auto_resolved():
    assert handover_defaults_resolved("informational") is True
    assert handover_defaults_resolved("follow_up_required") is False
