"""Map ORM rows to training platform API schemas."""

from __future__ import annotations

from typing import Any, cast

from app.models.training_platform_models import (
    TrainingCourse,
    TrainingFlashcard,
    TrainingLearningPath,
    TrainingLearningPathItem,
    TrainingLesson,
    TrainingReviewHistory,
    TrainingSection,
    TrainingUserProgress,
)
from app.services.training_platform.card_type_normalizer import normalize_study_type
from app.schemas.training_platform import (
    TrainingCourseKindApi,
    TrainingCourseOut,
    TrainingCourseStatusApi,
    TrainingCourseSummaryOut,
    TrainingFlashcardOut,
    TrainingLearningPathItemOut,
    TrainingLearningPathOut,
    TrainingLessonOut,
    TrainingProgressStatusApi,
    TrainingReviewHistoryOut,
    TrainingSectionOut,
    TrainingUserProgressOut,
)


def _meta(row: Any) -> dict[str, Any]:
    return dict(getattr(row, "metadata_", None) or {})


def _tags(row: Any) -> list[str]:
    raw = getattr(row, "tags", None) or []
    return [str(t) for t in raw]


def lesson_out(lesson: TrainingLesson) -> TrainingLessonOut:
    return TrainingLessonOut(
        id=str(lesson.id),
        company_id=str(lesson.company_id),
        course_id=str(lesson.course_id),
        section_id=str(lesson.section_id),
        procedure_id=str(lesson.procedure_id) if lesson.procedure_id else None,
        slug=lesson.slug,
        title=lesson.title,
        summary=lesson.summary,
        content_markdown=lesson.content_markdown,
        estimated_minutes=lesson.estimated_minutes,
        sort_order=int(lesson.sort_order or 0),
        tags=_tags(lesson),
        metadata=_meta(lesson),
    )


def section_out(section: TrainingSection, *, include_lessons: bool = True) -> TrainingSectionOut:
    lessons: list[TrainingLessonOut] = []
    if include_lessons and section.lessons:
        lessons = [lesson_out(l) for l in sorted(section.lessons, key=lambda x: x.sort_order or 0)]
    return TrainingSectionOut(
        id=str(section.id),
        company_id=str(section.company_id),
        course_id=str(section.course_id),
        parent_section_id=str(section.parent_section_id) if section.parent_section_id else None,
        slug=section.slug,
        title=section.title,
        description=section.description,
        sort_order=int(section.sort_order or 0),
        lessons=lessons,
    )


def course_out(course: TrainingCourse, *, include_sections: bool = True) -> TrainingCourseOut:
    sections: list[TrainingSectionOut] = []
    if include_sections and course.sections:
        sections = [
            section_out(s)
            for s in sorted(course.sections, key=lambda x: x.sort_order or 0)
        ]
    return TrainingCourseOut(
        id=str(course.id),
        company_id=str(course.company_id),
        certification_id=str(course.certification_id) if course.certification_id else None,
        procedure_id=str(course.procedure_id) if course.procedure_id else None,
        slug=course.slug,
        title=course.title,
        description=course.description,
        course_kind=cast(TrainingCourseKindApi, course.course_kind or "internal"),
        status=cast(TrainingCourseStatusApi, course.status or "draft"),
        completion_threshold_pct=int(course.completion_threshold_pct or 100),
        estimated_hours=course.estimated_hours,
        tags=_tags(course),
        metadata=_meta(course),
        published_at=course.published_at,
        sections=sections,
    )


def course_summary_out(
    course: TrainingCourse,
    *,
    progress_pct: int | None = None,
    progress_status: TrainingProgressStatusApi | None = None,
) -> TrainingCourseSummaryOut:
    return TrainingCourseSummaryOut(
        id=str(course.id),
        slug=course.slug,
        title=course.title,
        description=course.description,
        course_kind=cast(TrainingCourseKindApi, course.course_kind or "internal"),
        status=cast(TrainingCourseStatusApi, course.status or "draft"),
        completion_threshold_pct=int(course.completion_threshold_pct or 100),
        estimated_hours=course.estimated_hours,
        tags=_tags(course),
        procedure_id=str(course.procedure_id) if course.procedure_id else None,
        published_at=course.published_at,
        progress_pct=progress_pct,
        progress_status=progress_status,
    )


def flashcard_out(card: TrainingFlashcard) -> TrainingFlashcardOut:
    return TrainingFlashcardOut(
        id=str(card.id),
        company_id=str(card.company_id),
        course_id=str(card.course_id) if card.course_id else None,
        lesson_id=str(card.lesson_id) if card.lesson_id else None,
        procedure_id=str(card.procedure_id) if card.procedure_id else None,
        card_type=cast(Any, card.card_type or "flashcard"),
        study_type=normalize_study_type(card.card_type),
        prompt=card.prompt,
        answer=card.answer,
        explanation=card.explanation,
        difficulty=int(card.difficulty or 3),
        tags=_tags(card),
        options=dict(card.options or {}),
        sort_order=int(card.sort_order or 0),
    )


def review_history_out(row: TrainingReviewHistory) -> TrainingReviewHistoryOut:
    return TrainingReviewHistoryOut(
        id=str(row.id),
        flashcard_id=str(row.flashcard_id),
        ease_factor=float(row.ease_factor or 2.5),
        interval_days=int(row.interval_days or 0),
        repetitions=int(row.repetitions or 0),
        confidence=row.confidence,
        last_rating=cast(Any, row.last_rating) if row.last_rating else None,
        next_review_at=row.next_review_at,
        last_reviewed_at=row.last_reviewed_at,
    )


def user_progress_out(row: TrainingUserProgress) -> TrainingUserProgressOut:
    return TrainingUserProgressOut(
        id=str(row.id),
        user_id=str(row.user_id),
        scope_kind=cast(Any, row.scope_kind),
        scope_id=str(row.scope_id),
        status=cast(TrainingProgressStatusApi, row.status or "not_started"),
        progress_pct=int(row.progress_pct or 0),
        knowledge_score=row.knowledge_score,
        study_streak_days=int(row.study_streak_days or 0),
        weak_topics=[str(t) for t in (row.weak_topics or [])],
        due_at=row.due_at,
        last_accessed_at=row.last_accessed_at,
    )


def learning_path_item_out(item: TrainingLearningPathItem) -> TrainingLearningPathItemOut:
    return TrainingLearningPathItemOut(
        id=str(item.id),
        learning_path_id=str(item.learning_path_id),
        course_id=str(item.course_id) if item.course_id else None,
        lesson_id=str(item.lesson_id) if item.lesson_id else None,
        quiz_id=str(item.quiz_id) if item.quiz_id else None,
        sort_order=int(item.sort_order or 0),
        is_required=bool(item.is_required),
    )


def learning_path_out(path: TrainingLearningPath) -> TrainingLearningPathOut:
    items = [
        learning_path_item_out(i)
        for i in sorted(path.items or [], key=lambda x: x.sort_order or 0)
    ]
    return TrainingLearningPathOut(
        id=str(path.id),
        company_id=str(path.company_id),
        certification_id=str(path.certification_id) if path.certification_id else None,
        slug=path.slug,
        title=path.title,
        description=path.description,
        is_published=bool(path.is_published),
        items=items,
    )
