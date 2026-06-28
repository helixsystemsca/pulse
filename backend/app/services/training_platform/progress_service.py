"""User progress tracking for courses and lessons."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.training_platform_models import (
    TrainingCourse,
    TrainingLesson,
    TrainingProgressStatus,
    TrainingRecord,
    TrainingRecordKind,
    TrainingUserProgress,
)
from app.schemas.training_platform import TrainingProgressUpsertIn, TrainingUserProgressOut
from app.services.training_platform.serializers import user_progress_out

_FLASHCARD_HOLDER_LESSON_SUFFIX = "__flashcards"


async def _lesson_ids_for_course(db: AsyncSession, company_id: str, course_id: str) -> list[str]:
    rows = (
        await db.execute(
            select(TrainingLesson.id, TrainingLesson.slug).where(
                TrainingLesson.company_id == company_id,
                TrainingLesson.course_id == course_id,
            )
        )
    ).all()
    return [
        str(lesson_id)
        for lesson_id, slug in rows
        if not (slug or "").endswith(_FLASHCARD_HOLDER_LESSON_SUFFIX)
    ]


async def _completed_lesson_count(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    lesson_ids: list[str],
) -> int:
    if not lesson_ids:
        return 0
    count = (
        await db.execute(
            select(func.count())
            .select_from(TrainingUserProgress)
            .where(
                TrainingUserProgress.company_id == company_id,
                TrainingUserProgress.user_id == user_id,
                TrainingUserProgress.scope_kind == "lesson",
                TrainingUserProgress.scope_id.in_(lesson_ids),
                TrainingUserProgress.status == TrainingProgressStatus.completed.value,
            )
        )
    ).scalar_one()
    return int(count or 0)


async def _get_or_create_progress(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    scope_kind: str,
    scope_id: str,
    course_id: str | None = None,
    lesson_id: str | None = None,
) -> TrainingUserProgress:
    existing = (
        await db.execute(
            select(TrainingUserProgress).where(
                TrainingUserProgress.company_id == company_id,
                TrainingUserProgress.user_id == user_id,
                TrainingUserProgress.scope_kind == scope_kind,
                TrainingUserProgress.scope_id == scope_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    row = TrainingUserProgress(
        id=str(uuid.uuid4()),
        company_id=company_id,
        user_id=user_id,
        scope_kind=scope_kind,
        scope_id=scope_id,
        course_id=course_id,
        lesson_id=lesson_id,
        status=TrainingProgressStatus.not_started.value,
        progress_pct=0,
    )
    db.add(row)
    await db.flush()
    return row


async def upsert_progress(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    body: TrainingProgressUpsertIn,
) -> TrainingUserProgressOut:
    now = datetime.now(timezone.utc)
    course_id: str | None = None
    lesson_id: str | None = None

    if body.scope_kind == "lesson":
        lesson = (
            await db.execute(
                select(TrainingLesson).where(
                    TrainingLesson.company_id == company_id,
                    TrainingLesson.id == body.scope_id,
                )
            )
        ).scalar_one_or_none()
        if lesson is None:
            raise ValueError("lesson_not_found")
        course_id = str(lesson.course_id)
        lesson_id = str(lesson.id)
    elif body.scope_kind == "course":
        course = (
            await db.execute(
                select(TrainingCourse).where(
                    TrainingCourse.company_id == company_id,
                    TrainingCourse.id == body.scope_id,
                )
            )
        ).scalar_one_or_none()
        if course is None:
            raise ValueError("course_not_found")
        course_id = str(course.id)
    else:
        raise ValueError("unsupported_scope")

    row = await _get_or_create_progress(
        db,
        company_id=company_id,
        user_id=user_id,
        scope_kind=body.scope_kind,
        scope_id=body.scope_id,
        course_id=course_id,
        lesson_id=lesson_id,
    )

    row.status = body.status
    row.progress_pct = body.progress_pct
    row.last_accessed_at = now
    if body.status == TrainingProgressStatus.in_progress.value and row.started_at is None:
        row.started_at = now
    if body.status == TrainingProgressStatus.completed.value:
        row.completed_at = now
        row.progress_pct = max(int(row.progress_pct or 0), 100)

    await db.flush()

    if body.scope_kind == "lesson" and course_id:
        await _recompute_course_progress(db, company_id=company_id, user_id=user_id, course_id=course_id)

    await db.commit()
    await db.refresh(row)
    return user_progress_out(row)


async def _recompute_course_progress(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    course_id: str,
) -> None:
    course = (
        await db.execute(
            select(TrainingCourse).where(
                TrainingCourse.company_id == company_id,
                TrainingCourse.id == course_id,
            )
        )
    ).scalar_one_or_none()
    if course is None:
        return

    lesson_ids = await _lesson_ids_for_course(db, company_id, course_id)
    total = len(lesson_ids)
    completed = await _completed_lesson_count(db, company_id=company_id, user_id=user_id, lesson_ids=lesson_ids)
    pct = round((completed / total) * 100) if total else 0
    threshold = int(course.completion_threshold_pct or 100)
    status = TrainingProgressStatus.in_progress.value
    if pct >= threshold:
        status = TrainingProgressStatus.completed.value
    elif completed == 0:
        status = TrainingProgressStatus.not_started.value

    course_row = await _get_or_create_progress(
        db,
        company_id=company_id,
        user_id=user_id,
        scope_kind="course",
        scope_id=course_id,
        course_id=course_id,
    )
    now = datetime.now(timezone.utc)
    course_row.progress_pct = pct
    course_row.status = status
    course_row.last_accessed_at = now
    if course_row.started_at is None and completed > 0:
        course_row.started_at = now
    if status == TrainingProgressStatus.completed.value and course_row.completed_at is None:
        course_row.completed_at = now
        await _maybe_record_course_completion(db, company_id=company_id, user_id=user_id, course=course)


async def _maybe_record_course_completion(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    course: TrainingCourse,
) -> None:
    existing = (
        await db.execute(
            select(TrainingRecord.id).where(
                TrainingRecord.company_id == company_id,
                TrainingRecord.user_id == user_id,
                TrainingRecord.record_kind == TrainingRecordKind.course_completion.value,
                TrainingRecord.course_id == str(course.id),
            )
        )
    ).scalar_one_or_none()
    if existing:
        return

    db.add(
        TrainingRecord(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id=user_id,
            record_kind=TrainingRecordKind.course_completion.value,
            course_id=str(course.id),
            certification_id=str(course.certification_id) if course.certification_id else None,
            procedure_id=str(course.procedure_id) if course.procedure_id else None,
            passed=True,
            completed_on=date.today(),
        )
    )


async def list_user_course_progress(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
) -> list[TrainingUserProgressOut]:
    rows = list(
        (
            await db.execute(
                select(TrainingUserProgress)
                .where(
                    TrainingUserProgress.company_id == company_id,
                    TrainingUserProgress.user_id == user_id,
                    TrainingUserProgress.scope_kind == "course",
                )
                .order_by(TrainingUserProgress.last_accessed_at.desc().nullslast())
            )
        ).scalars().all()
    )
    return [user_progress_out(r) for r in rows]
