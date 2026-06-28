"""Tests for SM-2 spaced repetition scheduling."""

from datetime import datetime, timezone

from app.models.training_platform_models import TrainingReviewRating
from app.services.training_platform.sm2 import Sm2State, initial_sm2_state, sm2_update


def test_sm2_again_resets_progress():
    state = Sm2State(ease_factor=2.5, interval_days=14, repetitions=5)
    result = sm2_update(state, TrainingReviewRating.again)
    assert result.repetitions == 0
    assert result.interval_days == 1
    assert result.confidence == 1


def test_sm2_good_advances_interval():
    state = initial_sm2_state()
    first = sm2_update(state, TrainingReviewRating.good)
    assert first.repetitions == 1
    assert first.interval_days == 1

    second = sm2_update(
        Sm2State(first.ease_factor, first.interval_days, first.repetitions),
        TrainingReviewRating.good,
    )
    assert second.repetitions == 2
    assert second.interval_days == 6


def test_sm2_easy_increases_ease():
    state = initial_sm2_state()
    result = sm2_update(state, TrainingReviewRating.easy)
    assert result.ease_factor >= 2.5
    assert result.confidence == 5


def test_sm2_next_review_is_future():
    reviewed = datetime(2026, 6, 2, 12, 0, tzinfo=timezone.utc)
    result = sm2_update(initial_sm2_state(), TrainingReviewRating.good, reviewed_at=reviewed)
    assert result.next_review_at > reviewed
