"""Training deck (course) management — list, export, duplicate, archive, rename."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.training_platform_models import (
    TrainingCertification,
    TrainingCourse,
    TrainingCourseStatus,
    TrainingFlashcard,
    TrainingLesson,
    TrainingSection,
)
from app.schemas.training_platform import (
    TrainingDeckDuplicateIn,
    TrainingDeckRenameIn,
    TrainingDeckSummaryOut,
    TrainingImportPackIn,
)

_SECTION_FLASHCARD_LESSON_SUFFIX = "__flashcards"
_COURSE_FLASHCARD_SECTION_SLUG = "__course_flashcards__"
_IMPORT_ID_META_KEY = "import_id"
_DECK_VERSION_META_KEY = "deck_version"


def deck_version_from_metadata(metadata: dict[str, Any] | None) -> str:
    if not metadata:
        return "1.0"
    version = metadata.get(_DECK_VERSION_META_KEY)
    if isinstance(version, str) and version.strip():
        return version.strip()
    return "1.0"


def _slugify_copy(base: str) -> str:
    cleaned = re.sub(r"[^a-z0-9-]+", "-", base.lower()).strip("-") or "deck"
    return f"{cleaned}-copy"


async def list_training_decks(
    db: AsyncSession,
    *,
    company_id: str,
    include_archived: bool = True,
) -> list[TrainingDeckSummaryOut]:
    q = select(TrainingCourse).where(TrainingCourse.company_id == company_id)
    if not include_archived:
        q = q.where(TrainingCourse.status != TrainingCourseStatus.archived.value)
    q = q.order_by(TrainingCourse.title)
    courses = list((await db.execute(q)).scalars().all())
    if not courses:
        return []

    course_ids = [str(c.id) for c in courses]
    cert_ids = [str(c.certification_id) for c in courses if c.certification_id]
    certs_by_id: dict[str, TrainingCertification] = {}
    if cert_ids:
        cert_rows = list(
            (await db.execute(select(TrainingCertification).where(TrainingCertification.id.in_(cert_ids)))).scalars().all()
        )
        certs_by_id = {str(c.id): c for c in cert_rows}

    section_counts = {
        str(row.course_id): int(row.cnt)
        for row in (
            await db.execute(
                select(TrainingSection.course_id, func.count(TrainingSection.id).label("cnt"))
                .where(
                    TrainingSection.company_id == company_id,
                    TrainingSection.course_id.in_(course_ids),
                    TrainingSection.slug != _COURSE_FLASHCARD_SECTION_SLUG,
                )
                .group_by(TrainingSection.course_id)
            )
        ).all()
    }

    card_counts = {
        str(row.course_id): int(row.cnt)
        for row in (
            await db.execute(
                select(TrainingFlashcard.course_id, func.count(TrainingFlashcard.id).label("cnt"))
                .where(
                    TrainingFlashcard.company_id == company_id,
                    TrainingFlashcard.course_id.in_(course_ids),
                    TrainingFlashcard.is_active.is_(True),
                )
                .group_by(TrainingFlashcard.course_id)
            )
        ).all()
    }

    out: list[TrainingDeckSummaryOut] = []
    for course in courses:
        cid = str(course.id)
        cert = certs_by_id.get(str(course.certification_id)) if course.certification_id else None
        meta = dict(course.metadata_ or {})
        out.append(
            TrainingDeckSummaryOut(
                id=cid,
                slug=course.slug,
                title=course.title,
                description=course.description,
                course_kind=course.course_kind or "internal",
                status=course.status or "draft",
                certification_id=str(course.certification_id) if course.certification_id else None,
                certification_slug=cert.slug if cert else None,
                certification_title=cert.title if cert else None,
                deck_version=deck_version_from_metadata(meta),
                updated_at=course.updated_at,
                card_count=card_counts.get(cid, 0),
                section_count=section_counts.get(cid, 0),
                tags=[str(t) for t in (course.tags or [])],
            )
        )
    return out


async def _load_course_for_export(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
) -> TrainingCourse:
    course = (
        await db.execute(
            select(TrainingCourse)
            .where(TrainingCourse.company_id == company_id, TrainingCourse.id == course_id)
            .options(selectinload(TrainingCourse.sections).selectinload(TrainingSection.lessons))
        )
    ).scalar_one_or_none()
    if course is None:
        raise ValueError("course_not_found")
    return course


def _flashcard_export_dict(card: TrainingFlashcard) -> dict[str, Any]:
    meta = dict(card.metadata_ or {})
    out: dict[str, Any] = {
        "prompt": card.prompt,
        "answer": card.answer,
        "card_type": card.card_type or "flashcard",
        "difficulty": int(card.difficulty or 3),
        "tags": [str(t) for t in (card.tags or [])],
        "options": dict(card.options or {}),
    }
    if card.explanation:
        out["explanation"] = card.explanation
    import_id = meta.get(_IMPORT_ID_META_KEY)
    if import_id:
        out["id"] = str(import_id)
    return out


def _is_holder_lesson(slug: str) -> bool:
    return slug.endswith(_SECTION_FLASHCARD_LESSON_SUFFIX)


async def export_deck_pack(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
) -> TrainingImportPackIn:
    course = await _load_course_for_export(db, company_id=company_id, course_id=course_id)
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
    by_lesson: dict[str, list[TrainingFlashcard]] = {}
    for card in cards:
        if card.lesson_id:
            by_lesson.setdefault(str(card.lesson_id), []).append(card)

    cert_slug: str | None = None
    if course.certification_id:
        cert = (
            await db.execute(
                select(TrainingCertification).where(TrainingCertification.id == course.certification_id)
            )
        ).scalar_one_or_none()
        if cert:
            cert_slug = cert.slug

    course_flashcards: list[dict[str, Any]] = []
    sections_out: list[dict[str, Any]] = []

    for section in sorted(course.sections, key=lambda s: s.sort_order or 0):
        if section.slug == _COURSE_FLASHCARD_SECTION_SLUG:
            for lesson in sorted(section.lessons, key=lambda l: l.sort_order or 0):
                for card in by_lesson.get(str(lesson.id), []):
                    course_flashcards.append(_flashcard_export_dict(card))
            continue

        section_fc: list[dict[str, Any]] = []
        lessons_out: list[dict[str, Any]] = []
        for lesson in sorted(section.lessons, key=lambda l: l.sort_order or 0):
            lesson_cards = by_lesson.get(str(lesson.id), [])
            if _is_holder_lesson(lesson.slug):
                section_fc.extend(_flashcard_export_dict(c) for c in lesson_cards)
                continue
            if lesson_cards:
                lessons_out.append(
                    {
                        "slug": lesson.slug,
                        "title": lesson.title,
                        "summary": lesson.summary,
                        "content_markdown": lesson.content_markdown,
                        "estimated_minutes": lesson.estimated_minutes,
                        "tags": [str(t) for t in (lesson.tags or [])],
                        "flashcards": [_flashcard_export_dict(c) for c in lesson_cards],
                    }
                )
            elif lesson.content_markdown or lesson.summary:
                lessons_out.append(
                    {
                        "slug": lesson.slug,
                        "title": lesson.title,
                        "summary": lesson.summary,
                        "content_markdown": lesson.content_markdown,
                        "estimated_minutes": lesson.estimated_minutes,
                        "tags": [str(t) for t in (lesson.tags or [])],
                        "flashcards": [],
                    }
                )

        sections_out.append(
            {
                "slug": section.slug,
                "title": section.title,
                "description": section.description,
                "flashcards": section_fc,
                "lessons": lessons_out,
            }
        )

    meta = dict(course.metadata_ or {})
    course_dict: dict[str, Any] = {
        "slug": course.slug,
        "title": course.title,
        "description": course.description,
        "course_kind": course.course_kind or "certification",
        "completion_threshold_pct": int(course.completion_threshold_pct or 100),
        "estimated_hours": course.estimated_hours,
        "tags": [str(t) for t in (course.tags or [])],
        "sections": sections_out,
        "flashcards": course_flashcards,
    }
    if cert_slug:
        course_dict["certification_slug"] = cert_slug

    return TrainingImportPackIn(
        version=deck_version_from_metadata(meta),
        source_name=f"export-{course.slug}",
        courses=[course_dict],
    )


async def rename_deck(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
    body: TrainingDeckRenameIn,
) -> TrainingDeckSummaryOut:
    course = (
        await db.execute(
            select(TrainingCourse).where(TrainingCourse.company_id == company_id, TrainingCourse.id == course_id)
        )
    ).scalar_one_or_none()
    if course is None:
        raise ValueError("course_not_found")

    course.title = body.title.strip()
    if body.description is not None:
        course.description = body.description.strip() or None
    course.updated_at = datetime.now(timezone.utc)
    await db.flush()
    decks = await list_training_decks(db, company_id=company_id, include_archived=True)
    match = next((d for d in decks if d.id == course_id), None)
    if match is None:
        raise ValueError("course_not_found")
    return match


async def archive_deck(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
) -> TrainingDeckSummaryOut:
    course = (
        await db.execute(
            select(TrainingCourse).where(TrainingCourse.company_id == company_id, TrainingCourse.id == course_id)
        )
    ).scalar_one_or_none()
    if course is None:
        raise ValueError("course_not_found")
    course.status = TrainingCourseStatus.archived.value
    course.updated_at = datetime.now(timezone.utc)
    await db.flush()
    decks = await list_training_decks(db, company_id=company_id, include_archived=True)
    match = next((d for d in decks if d.id == course_id), None)
    if match is None:
        raise ValueError("course_not_found")
    return match


async def _unique_course_slug(db: AsyncSession, company_id: str, desired: str) -> str:
    slug = desired[:128]
    existing = (
        await db.execute(
            select(TrainingCourse.slug).where(TrainingCourse.company_id == company_id, TrainingCourse.slug == slug)
        )
    ).scalar_one_or_none()
    if existing is None:
        return slug
    for i in range(2, 100):
        candidate = f"{desired[:120]}-{i}"[:128]
        taken = (
            await db.execute(
                select(TrainingCourse.slug).where(
                    TrainingCourse.company_id == company_id, TrainingCourse.slug == candidate
                )
            )
        ).scalar_one_or_none()
        if taken is None:
            return candidate
    return f"{desired[:100]}-{uuid.uuid4().hex[:8]}"


async def duplicate_deck(
    db: AsyncSession,
    *,
    company_id: str,
    course_id: str,
    body: TrainingDeckDuplicateIn,
    user_id: str | None = None,
) -> TrainingDeckSummaryOut:
    source = await _load_course_for_export(db, company_id=company_id, course_id=course_id)
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

    new_slug = body.new_slug.strip() if body.new_slug else _slugify_copy(source.slug)
    new_slug = await _unique_course_slug(db, company_id, new_slug)
    new_title = (body.new_title or f"{source.title} (Copy)").strip()
    meta = dict(source.metadata_ or {})

    new_course = TrainingCourse(
        id=str(uuid.uuid4()),
        company_id=company_id,
        certification_id=source.certification_id,
        slug=new_slug,
        title=new_title,
        description=source.description,
        course_kind=source.course_kind,
        status=TrainingCourseStatus.published.value,
        completion_threshold_pct=source.completion_threshold_pct,
        estimated_hours=source.estimated_hours,
        tags=list(source.tags or []),
        metadata_={**meta, _DECK_VERSION_META_KEY: deck_version_from_metadata(meta)},
        created_by_user_id=user_id,
    )
    db.add(new_course)
    await db.flush()

    lesson_map: dict[str, str] = {}
    for section in sorted(source.sections, key=lambda s: s.sort_order or 0):
        new_section = TrainingSection(
            id=str(uuid.uuid4()),
            company_id=company_id,
            course_id=str(new_course.id),
            parent_section_id=None,
            slug=section.slug,
            title=section.title,
            description=section.description,
            sort_order=int(section.sort_order or 0),
        )
        db.add(new_section)
        await db.flush()
        for lesson in sorted(section.lessons, key=lambda l: l.sort_order or 0):
            new_lesson = TrainingLesson(
                id=str(uuid.uuid4()),
                company_id=company_id,
                course_id=str(new_course.id),
                section_id=str(new_section.id),
                slug=lesson.slug,
                title=lesson.title,
                summary=lesson.summary,
                content_markdown=lesson.content_markdown,
                estimated_minutes=lesson.estimated_minutes,
                sort_order=int(lesson.sort_order or 0),
                tags=list(lesson.tags or []),
                metadata_=dict(lesson.metadata_ or {}),
            )
            db.add(new_lesson)
            await db.flush()
            lesson_map[str(lesson.id)] = str(new_lesson.id)

    sort_order = 0
    for card in sorted(cards, key=lambda c: (c.sort_order or 0, c.created_at or datetime.min.replace(tzinfo=timezone.utc))):
        new_lesson_id = lesson_map.get(str(card.lesson_id)) if card.lesson_id else None
        db.add(
            TrainingFlashcard(
                id=str(uuid.uuid4()),
                company_id=company_id,
                course_id=str(new_course.id),
                lesson_id=new_lesson_id,
                card_type=card.card_type,
                prompt=card.prompt,
                answer=card.answer,
                explanation=card.explanation,
                difficulty=card.difficulty,
                tags=list(card.tags or []),
                options=dict(card.options or {}),
                metadata_=dict(card.metadata_ or {}),
                sort_order=sort_order,
                is_active=True,
            )
        )
        sort_order += 1

    await db.flush()
    decks = await list_training_decks(db, company_id=company_id, include_archived=True)
    match = next((d for d in decks if d.id == str(new_course.id)), None)
    if match is None:
        raise ValueError("course_not_found")
    return match


def set_deck_version_on_course(course: TrainingCourse, version: str) -> None:
    meta = dict(course.metadata_ or {})
    meta[_DECK_VERSION_META_KEY] = version
    course.metadata_ = meta
