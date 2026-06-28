"""Spaced-repetition study queue and review submission."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.training_platform_models import TrainingCourse, TrainingFlashcard, TrainingReviewHistory, TrainingReviewRating
from app.schemas.training_platform import (
    TrainingCourseFlashcardsOut,
    TrainingFlashcardReviewSubmit,
    TrainingSm2StateOut,
    TrainingStudyDueCardOut,
    TrainingStudyDueOut,
)
from app.services.training_platform.serializers import flashcard_out, review_history_out
from app.services.training_platform.sm2 import Sm2State, initial_sm2_state, sm2_update


async def list_due_flashcards(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    limit: int = 30,
) -> TrainingStudyDueOut:
    now = datetime.now(timezone.utc)
    cards = list(
        (
            await db.execute(
                select(TrainingFlashcard)
                .where(
                    TrainingFlashcard.company_id == company_id,
                    TrainingFlashcard.is_active.is_(True),
                )
                .order_by(TrainingFlashcard.sort_order, TrainingFlashcard.created_at)
            )
        ).scalars().all()
    )
    if not cards:
        return TrainingStudyDueOut(cards=[], due_count=0)

    card_ids = [str(c.id) for c in cards]
    reviews = list(
        (
            await db.execute(
                select(TrainingReviewHistory).where(
                    TrainingReviewHistory.company_id == company_id,
                    TrainingReviewHistory.user_id == user_id,
                    TrainingReviewHistory.flashcard_id.in_(card_ids),
                )
            )
        ).scalars().all()
    )
    review_by_card = {str(r.flashcard_id): r for r in reviews}

    due: list[TrainingStudyDueCardOut] = []
    for card in cards:
        cid = str(card.id)
        review = review_by_card.get(cid)
        is_due = review is None or review.next_review_at is None or review.next_review_at <= now
        if not is_due:
            continue
        due.append(
            TrainingStudyDueCardOut(
                flashcard=flashcard_out(card),
                review=review_history_out(review) if review else None,
            )
        )
        if len(due) >= limit:
            break

    return TrainingStudyDueOut(cards=due, due_count=len(due))


async def list_course_flashcards(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    course_id: str,
) -> TrainingCourseFlashcardsOut:
    course = (
        await db.execute(
            select(TrainingCourse).where(
                TrainingCourse.company_id == company_id,
                TrainingCourse.id == course_id,
            )
        )
    ).scalar_one_or_none()
    if course is None:
        raise ValueError("course_not_found")

    cards = list(
        (
            await db.execute(
                select(TrainingFlashcard)
                .where(
                    TrainingFlashcard.company_id == company_id,
                    TrainingFlashcard.course_id == course_id,
                    TrainingFlashcard.is_active.is_(True),
                )
                .order_by(TrainingFlashcard.sort_order, TrainingFlashcard.created_at)
            )
        ).scalars().all()
    )
    if not cards:
        return TrainingCourseFlashcardsOut(
            course_id=str(course.id),
            course_title=course.title,
            cards=[],
            total=0,
        )

    card_ids = [str(c.id) for c in cards]
    reviews = list(
        (
            await db.execute(
                select(TrainingReviewHistory).where(
                    TrainingReviewHistory.company_id == company_id,
                    TrainingReviewHistory.user_id == user_id,
                    TrainingReviewHistory.flashcard_id.in_(card_ids),
                )
            )
        ).scalars().all()
    )
    review_by_card = {str(r.flashcard_id): r for r in reviews}

    out_cards = [
        TrainingStudyDueCardOut(
            flashcard=flashcard_out(card),
            review=review_history_out(review_by_card[str(card.id)]) if str(card.id) in review_by_card else None,
        )
        for card in cards
    ]
    return TrainingCourseFlashcardsOut(
        course_id=str(course.id),
        course_title=course.title,
        cards=out_cards,
        total=len(out_cards),
    )


async def submit_flashcard_review(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    flashcard_id: str,
    body: TrainingFlashcardReviewSubmit,
) -> TrainingSm2StateOut:
    card = (
        await db.execute(
            select(TrainingFlashcard).where(
                TrainingFlashcard.company_id == company_id,
                TrainingFlashcard.id == flashcard_id,
                TrainingFlashcard.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if card is None:
        raise ValueError("flashcard_not_found")

    row = (
        await db.execute(
            select(TrainingReviewHistory).where(
                TrainingReviewHistory.company_id == company_id,
                TrainingReviewHistory.user_id == user_id,
                TrainingReviewHistory.flashcard_id == flashcard_id,
            )
        )
    ).scalar_one_or_none()

    reviewed_at = body.reviewed_at or datetime.now(timezone.utc)
    if reviewed_at.tzinfo is None:
        reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)

    if row is None:
        state = initial_sm2_state()
        row = TrainingReviewHistory(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id=user_id,
            flashcard_id=flashcard_id,
            ease_factor=state.ease_factor,
            interval_days=state.interval_days,
            repetitions=state.repetitions,
        )
        db.add(row)
        await db.flush()

    prior = Sm2State(
        ease_factor=float(row.ease_factor or 2.5),
        interval_days=int(row.interval_days or 0),
        repetitions=int(row.repetitions or 0),
    )
    result = sm2_update(prior, body.rating, reviewed_at=reviewed_at)

    log_entry = {
        "rating": body.rating,
        "reviewed_at": reviewed_at.isoformat(),
        "interval_days": result.interval_days,
        "ease_factor": result.ease_factor,
    }
    review_log = list(row.review_log or [])
    review_log.append(log_entry)
    if len(review_log) > 50:
        review_log = review_log[-50:]

    row.ease_factor = result.ease_factor
    row.interval_days = result.interval_days
    row.repetitions = result.repetitions
    row.confidence = result.confidence
    row.last_rating = body.rating
    row.next_review_at = result.next_review_at
    row.last_reviewed_at = reviewed_at
    row.review_log = review_log

    await db.commit()

    return TrainingSm2StateOut(
        ease_factor=result.ease_factor,
        interval_days=result.interval_days,
        repetitions=result.repetitions,
        next_review_at=result.next_review_at,
        confidence=result.confidence,
    )


async def count_due_flashcards(db: AsyncSession, *, company_id: str, user_id: str) -> int:
    due = await list_due_flashcards(db, company_id=company_id, user_id=user_id, limit=500)
    return due.due_count
