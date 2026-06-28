"""Aggregate flashcard study statistics for a course."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.training_platform_models import (
    TrainingCourse,
    TrainingFlashcard,
    TrainingReviewHistory,
    TrainingSection,
)
from app.schemas.training_platform import (
    TrainingStudyStatisticsByCardTypeOut,
    TrainingStudyStatisticsMissedCardOut,
    TrainingStudyStatisticsOut,
    TrainingStudyStatisticsSectionOut,
)
from app.services.training_platform.card_type_normalizer import normalize_study_type

_SECTION_FLASHCARD_SLUG_SUFFIX = "__flashcards"
_HIDDEN_SECTION_SLUG = "__course_flashcards__"
_CORRECT_RATINGS = frozenset({"good", "easy"})
_MISS_RATINGS = frozenset({"again", "unsure"})


@dataclass
class _ReviewEvent:
    flashcard_id: str
    lesson_id: str | None
    rating: str
    reviewed_at: datetime
    study_type: str


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_reviewed_at(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            text = str(value).replace("Z", "+00:00")
            dt = datetime.fromisoformat(text)
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _date_key(dt: datetime) -> date:
    return dt.astimezone(timezone.utc).date()


def _is_mastered(review: TrainingReviewHistory, now: datetime) -> bool:
    rating = review.last_rating
    if rating not in _CORRECT_RATINGS:
        return False
    if review.next_review_at is not None:
        nra = review.next_review_at
        if nra.tzinfo is None:
            nra = nra.replace(tzinfo=timezone.utc)
        return nra > now
    return int(review.repetitions or 0) >= 1


def _is_due(review: TrainingReviewHistory | None, now: datetime) -> bool:
    if review is None:
        return True
    if review.next_review_at is None:
        return True
    nra = review.next_review_at
    if nra.tzinfo is None:
        nra = nra.replace(tzinfo=timezone.utc)
    return nra <= now


def _streak_days(study_dates: set[date], *, through: date) -> int:
    if not study_dates:
        return 0
    yesterday = through - timedelta(days=1)
    if through in study_dates:
        cursor = through
    elif yesterday in study_dates:
        cursor = yesterday
    else:
        return 0

    streak = 0
    while cursor in study_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _longest_streak(study_dates: set[date]) -> int:
    if not study_dates:
        return 0
    best = 1
    current = 1
    ordered = sorted(study_dates)
    for i in range(1, len(ordered)):
        if ordered[i] == ordered[i - 1] + timedelta(days=1):
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best


def _collect_review_events(
    cards: list[TrainingFlashcard],
    reviews: dict[str, TrainingReviewHistory],
) -> list[_ReviewEvent]:
    events: list[_ReviewEvent] = []
    for card in cards:
        cid = str(card.id)
        study_type = normalize_study_type(card.card_type)
        review = reviews.get(cid)
        if review is None:
            continue
        log = list(review.review_log or [])
        if log:
            for entry in log:
                if not isinstance(entry, dict):
                    continue
                rating = str(entry.get("rating") or "")
                reviewed_at = _parse_reviewed_at(entry.get("reviewed_at"))
                if not rating or reviewed_at is None:
                    continue
                events.append(
                    _ReviewEvent(
                        flashcard_id=cid,
                        lesson_id=str(card.lesson_id) if card.lesson_id else None,
                        rating=rating,
                        reviewed_at=reviewed_at,
                        study_type=study_type,
                    )
                )
        elif review.last_reviewed_at and review.last_rating:
            reviewed_at = _parse_reviewed_at(review.last_reviewed_at)
            if reviewed_at is not None:
                events.append(
                    _ReviewEvent(
                        flashcard_id=cid,
                        lesson_id=str(card.lesson_id) if card.lesson_id else None,
                        rating=str(review.last_rating),
                        reviewed_at=reviewed_at,
                        study_type=study_type,
                    )
                )
    return events


def _lesson_section_map(sections: list[TrainingSection]) -> dict[str, TrainingSection]:
    out: dict[str, TrainingSection] = {}
    for section in sections:
        if section.slug == _HIDDEN_SECTION_SLUG:
            continue
        for lesson in section.lessons or []:
            out[str(lesson.id)] = section
    return out


async def get_course_study_statistics(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    course_id: str,
) -> TrainingStudyStatisticsOut:
    course = (
        await db.execute(
            select(TrainingCourse)
            .where(TrainingCourse.company_id == company_id, TrainingCourse.id == course_id)
            .options(selectinload(TrainingCourse.sections).selectinload(TrainingSection.lessons))
        )
    ).scalar_one_or_none()
    if course is None:
        raise ValueError("course_not_found")

    cards = list(
        (
            await db.execute(
                select(TrainingFlashcard).where(
                    TrainingFlashcard.company_id == company_id,
                    TrainingFlashcard.course_id == course_id,
                    TrainingFlashcard.is_active.is_(True),
                )
            )
        ).scalars().all()
    )

    card_ids = [str(c.id) for c in cards]
    reviews_list = (
        (
            await db.execute(
                select(TrainingReviewHistory).where(
                    TrainingReviewHistory.company_id == company_id,
                    TrainingReviewHistory.user_id == user_id,
                    TrainingReviewHistory.flashcard_id.in_(card_ids),
                )
            )
        ).scalars().all()
        if card_ids
        else []
    )
    reviews = {str(r.flashcard_id): r for r in reviews_list}

    now = _utc_now()
    today = _date_key(now)
    week_start = today - timedelta(days=6)
    month_start = today - timedelta(days=29)

    events = _collect_review_events(cards, reviews)
    study_dates = {_date_key(e.reviewed_at) for e in events}

    cards_reviewed_today = sum(1 for e in events if _date_key(e.reviewed_at) == today)
    cards_reviewed_week = sum(1 for e in events if week_start <= _date_key(e.reviewed_at) <= today)
    cards_reviewed_month = sum(1 for e in events if month_start <= _date_key(e.reviewed_at) <= today)

    total_ratings = len(events)
    correct = sum(1 for e in events if e.rating in _CORRECT_RATINGS)
    accuracy_pct = round((correct / total_ratings) * 100) if total_ratings > 0 else None

    cards_mastered = sum(
        1 for c in cards if str(c.id) in reviews and _is_mastered(reviews[str(c.id)], now)
    )
    cards_due = sum(
        1 for c in cards if _is_due(reviews.get(str(c.id)), now)
    )

    lesson_sections = _lesson_section_map(list(course.sections or []))
    section_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"total": 0, "correct": 0, "misses": 0, "title": "Unknown"}
    )
    card_misses: dict[str, int] = defaultdict(int)
    card_prompts: dict[str, str] = {str(c.id): c.prompt for c in cards}
    card_lessons: dict[str, str | None] = {str(c.id): str(c.lesson_id) if c.lesson_id else None for c in cards}

    for event in events:
        if event.rating in _MISS_RATINGS:
            card_misses[event.flashcard_id] += 1
        section = lesson_sections.get(event.lesson_id or "")
        section_id = str(section.id) if section else "unknown"
        bucket = section_stats[section_id]
        if section:
            bucket["title"] = section.title
        bucket["total"] += 1
        if event.rating in _CORRECT_RATINGS:
            bucket["correct"] += 1
        if event.rating in _MISS_RATINGS:
            bucket["misses"] += 1

    weakest_sections: list[TrainingStudyStatisticsSectionOut] = []
    for section_id, bucket in section_stats.items():
        if section_id == "unknown" or bucket["total"] == 0:
            continue
        sec_accuracy = round((bucket["correct"] / bucket["total"]) * 100)
        weakest_sections.append(
            TrainingStudyStatisticsSectionOut(
                section_id=section_id,
                section_title=str(bucket["title"]),
                accuracy_pct=sec_accuracy,
                reviews_count=int(bucket["total"]),
                miss_count=int(bucket["misses"]),
            )
        )
    weakest_sections.sort(key=lambda s: (s.accuracy_pct, -s.miss_count, s.section_title))

    type_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "correct": 0})
    for event in events:
        bucket = type_stats[event.study_type]
        bucket["total"] += 1
        if event.rating in _CORRECT_RATINGS:
            bucket["correct"] += 1
    by_card_type: list[TrainingStudyStatisticsByCardTypeOut] = []
    for study_type, bucket in sorted(type_stats.items(), key=lambda x: x[0]):
        total = int(bucket["total"])
        correct = int(bucket["correct"])
        by_card_type.append(
            TrainingStudyStatisticsByCardTypeOut(
                study_type=study_type,
                reviews_count=total,
                correct_count=correct,
                accuracy_pct=round((correct / total) * 100) if total > 0 else 0,
            )
        )

    most_missed: list[TrainingStudyStatisticsMissedCardOut] = []
    for flashcard_id, miss_count in sorted(card_misses.items(), key=lambda x: (-x[1], x[0]))[:8]:
        lesson_id = card_lessons.get(flashcard_id)
        section = lesson_sections.get(lesson_id or "")
        most_missed.append(
            TrainingStudyStatisticsMissedCardOut(
                flashcard_id=flashcard_id,
                prompt=card_prompts.get(flashcard_id, ""),
                miss_count=miss_count,
                section_id=str(section.id) if section else None,
                section_title=section.title if section else None,
            )
        )

    return TrainingStudyStatisticsOut(
        course_id=str(course.id),
        course_title=course.title,
        cards_reviewed_today=cards_reviewed_today,
        cards_reviewed_week=cards_reviewed_week,
        cards_reviewed_month=cards_reviewed_month,
        current_streak_days=_streak_days(study_dates, through=today),
        longest_streak_days=_longest_streak(study_dates),
        accuracy_pct=accuracy_pct,
        cards_mastered=cards_mastered,
        cards_due=cards_due,
        weakest_sections=weakest_sections[:5],
        most_missed_cards=most_missed,
        by_card_type=by_card_type,
    )
