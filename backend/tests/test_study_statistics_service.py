"""Unit tests for study statistics aggregation."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.services.training_platform.study_statistics_service import (
    _collect_review_events,
    _longest_streak,
    _streak_days,
)


class _Card:
    def __init__(self, card_id: str, lesson_id: str | None) -> None:
        self.id = card_id
        self.lesson_id = lesson_id


class _Review:
    def __init__(
        self,
        flashcard_id: str,
        *,
        last_rating: str | None = None,
        last_reviewed_at: datetime | None = None,
        review_log: list | None = None,
    ) -> None:
        self.flashcard_id = flashcard_id
        self.last_rating = last_rating
        self.last_reviewed_at = last_reviewed_at
        self.review_log = review_log or []


def test_streak_days_counts_through_today() -> None:
    today = date(2026, 6, 27)
    dates = {today, today - timedelta(days=1), today - timedelta(days=2)}
    assert _streak_days(dates, through=today) == 3


def test_streak_days_allows_yesterday_when_today_empty() -> None:
    today = date(2026, 6, 27)
    dates = {today - timedelta(days=1), today - timedelta(days=2)}
    assert _streak_days(dates, through=today) == 2


def test_longest_streak_finds_best_run() -> None:
    dates = {
        date(2026, 6, 1),
        date(2026, 6, 2),
        date(2026, 6, 10),
        date(2026, 6, 11),
        date(2026, 6, 12),
    }
    assert _longest_streak(dates) == 3


def test_collect_review_events_prefers_review_log() -> None:
    cards = [_Card("fc-1", "lesson-1")]
    reviews = {
        "fc-1": _Review(
            "fc-1",
            last_rating="good",
            last_reviewed_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            review_log=[
                {"rating": "again", "reviewed_at": "2026-06-27T10:00:00+00:00"},
                {"rating": "good", "reviewed_at": "2026-06-27T11:00:00+00:00"},
            ],
        )
    }
    events = _collect_review_events(cards, reviews)  # type: ignore[arg-type]
    assert len(events) == 2
    assert events[0].rating == "again"
