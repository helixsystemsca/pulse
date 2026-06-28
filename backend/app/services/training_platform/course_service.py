"""Course catalog and detail queries."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.training_platform_models import (
    TrainingCourse,
    TrainingCourseStatus,
    TrainingLesson,
    TrainingSection,
    TrainingUserProgress,
)
from app.schemas.training_platform import TrainingCourseOut, TrainingCourseSummaryOut, TrainingLessonOut
from app.services.training_platform.serializers import course_out, course_summary_out, lesson_out


async def list_published_courses(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    include_drafts: bool = False,
) -> list[TrainingCourseSummaryOut]:
    q = select(TrainingCourse).where(TrainingCourse.company_id == company_id)
    if not include_drafts:
        q = q.where(TrainingCourse.status == TrainingCourseStatus.published.value)
    q = q.order_by(TrainingCourse.title)
    courses = list((await db.execute(q)).scalars().all())
    if not courses:
        return []

    course_ids = [str(c.id) for c in courses]
    pq = await db.execute(
        select(TrainingUserProgress).where(
            TrainingUserProgress.company_id == company_id,
            TrainingUserProgress.user_id == user_id,
            TrainingUserProgress.scope_kind == "course",
            TrainingUserProgress.scope_id.in_(course_ids),
        )
    )
    progress_by_course = {str(p.scope_id): p for p in pq.scalars().all()}

    out: list[TrainingCourseSummaryOut] = []
    for c in courses:
        prog = progress_by_course.get(str(c.id))
        out.append(
            course_summary_out(
                c,
                progress_pct=int(prog.progress_pct) if prog else None,
                progress_status=prog.status if prog else None,  # type: ignore[arg-type]
            )
        )
    return out


async def get_course_detail(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
    include_drafts: bool = False,
) -> TrainingCourseOut | None:
    q = (
        select(TrainingCourse)
        .where(TrainingCourse.company_id == company_id, TrainingCourse.id == course_id)
        .options(selectinload(TrainingCourse.sections).selectinload(TrainingSection.lessons))
    )
    course = (await db.execute(q)).scalar_one_or_none()
    if course is None:
        return None
    if not include_drafts and course.status != TrainingCourseStatus.published.value:
        return None
    return course_out(course)


async def get_lesson_detail(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
    lesson_id: str,
    include_drafts: bool = False,
) -> TrainingLessonOut | None:
    lesson = (
        await db.execute(
            select(TrainingLesson).where(
                TrainingLesson.company_id == company_id,
                TrainingLesson.course_id == course_id,
                TrainingLesson.id == lesson_id,
            )
        )
    ).scalar_one_or_none()
    if lesson is None:
        return None
    if not include_drafts:
        status = (
            await db.execute(
                select(TrainingCourse.status).where(
                    TrainingCourse.company_id == company_id,
                    TrainingCourse.id == course_id,
                )
            )
        ).scalar_one_or_none()
        if status != TrainingCourseStatus.published.value:
            return None
    return lesson_out(lesson)
