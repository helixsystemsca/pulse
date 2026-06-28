"""SM-2 spaced repetition scheduling for training flashcards."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.models.training_platform_models import TrainingReviewRating

MIN_EASE = 1.3
DEFAULT_EASE = 2.5


@dataclass(frozen=True)
class Sm2State:
    ease_factor: float
    interval_days: int
    repetitions: int


@dataclass(frozen=True)
class Sm2UpdateResult:
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review_at: datetime
    confidence: int


def _rating_to_quality(rating: TrainingReviewRating | str) -> int:
    """Map Helix confidence buttons to SM-2 quality 0–5."""
    value = rating.value if isinstance(rating, TrainingReviewRating) else str(rating)
    return {
        TrainingReviewRating.again.value: 1,
        TrainingReviewRating.unsure.value: 3,
        TrainingReviewRating.good.value: 4,
        TrainingReviewRating.easy.value: 5,
    }.get(value, 3)


def _confidence_from_quality(quality: int) -> int:
    if quality <= 1:
        return 1
    if quality == 3:
        return 2
    if quality == 4:
        return 4
    return 5


def sm2_update(
    state: Sm2State,
    rating: TrainingReviewRating | str,
    *,
    reviewed_at: datetime | None = None,
) -> Sm2UpdateResult:
    """
    Apply one SM-2 review step.

    Ratings:
    - again: reset repetitions, short interval
    - unsure: reduced ease, modest interval
    - good: standard SM-2 progression
    - easy: increased ease, longer interval
    """
    now = reviewed_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    quality = _rating_to_quality(rating)
    ease = state.ease_factor
    interval = state.interval_days
    reps = state.repetitions

    if quality < 3:
        reps = 0
        interval = 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = max(1, round(interval * ease))
        reps += 1

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(MIN_EASE, ease)

    next_review = now + timedelta(days=interval)
    confidence = _confidence_from_quality(quality)

    return Sm2UpdateResult(
        ease_factor=round(ease, 2),
        interval_days=interval,
        repetitions=reps,
        next_review_at=next_review,
        confidence=confidence,
    )


def initial_sm2_state() -> Sm2State:
    return Sm2State(ease_factor=DEFAULT_EASE, interval_days=0, repetitions=0)
