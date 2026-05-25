"""Training matrix shift scoping — arena routines and matrix_shift keywords."""

from __future__ import annotations

from app.services.training_matrix_shift_scope import (
    is_arena_shift_routine_title,
    worker_should_see_procedure_for_shift_scoping,
)


def test_arena_shift_titles_always_visible_for_day_worker() -> None:
    assert is_arena_shift_routine_title("Arena A — Afternoon")
    assert worker_should_see_procedure_for_shift_scoping(
        "full_time",
        "day",
        ["matrix_shift:afternoon"],
        "Arena A — Afternoon",
    )


def test_non_arena_shift_tag_still_scoped() -> None:
    assert not worker_should_see_procedure_for_shift_scoping(
        "full_time",
        "day",
        ["matrix_shift:afternoon"],
        "Pool Changerooms — Afternoon Shift",
    )


def test_arena_b_night_loose_title() -> None:
    assert is_arena_shift_routine_title("Arena B - Night Shift")
    assert worker_should_see_procedure_for_shift_scoping(
        "regular_part_time",
        "day",
        ["matrix_shift:night"],
        "Arena B - Night Shift",
    )
