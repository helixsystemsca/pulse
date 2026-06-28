"""Bulk JSON import for training courses (CAPM packs, org course libraries)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.training_platform_models import (
    TrainingCertification,
    TrainingCourse,
    TrainingCourseStatus,
    TrainingFlashcard,
    TrainingImportBatch,
    TrainingKnowledgeEdge,
    TrainingLesson,
    TrainingQuestion,
    TrainingQuiz,
    TrainingSection,
)
from app.schemas.training_platform import (
    TrainingImportFlashcardIn,
    TrainingImportIssueOut,
    TrainingImportPackIn,
    TrainingImportResultOut,
    TrainingImportSectionIn,
)
from app.services.training_platform.card_type_normalizer import merge_flashcard_option_fields
from app.services.training_platform.deck_service import set_deck_version_on_course
from app.services.training_platform.import_validation import (
    ImportValidationResult,
    TrainingImportValidationError,
    ensure_valid_import_pack,
)

_SECTION_FLASHCARD_LESSON_SUFFIX = "__flashcards"
_IMPORT_ID_META_KEY = "import_id"


class TrainingImportService:
    """Upsert importer: courses/sections by slug; flashcards by metadata.import_id or prompt match."""

    def __init__(self, db: Session, *, company_id: str, user_id: str | None = None) -> None:
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    def import_pack(self, pack: TrainingImportPackIn) -> TrainingImportResultOut:
        validation = ensure_valid_import_pack(pack)
        return self._import_validated_pack(pack, validation)

    def import_pack_from_validation(self, pack: TrainingImportPackIn, validation: ImportValidationResult) -> TrainingImportResultOut:
        if not validation.ok:
            raise TrainingImportValidationError(validation)
        return self._import_validated_pack(pack, validation)

    def _import_validated_pack(
        self,
        pack: TrainingImportPackIn,
        validation: ImportValidationResult,
    ) -> TrainingImportResultOut:
        stats: dict[str, int] = {
            "certifications": 0,
            "courses": 0,
            "sections": 0,
            "lessons": 0,
            "flashcards": 0,
            "quizzes": 0,
            "questions": 0,
            "knowledge_edges": 0,
        }
        created: dict[str, int] = {k: 0 for k in stats}
        updated: dict[str, int] = {k: 0 for k in stats}
        skipped: dict[str, int] = {k: 0 for k in stats}

        cert_by_slug = self._load_certifications_by_slug()

        for cert_in in pack.certifications:
            existing = cert_by_slug.get(cert_in.slug)
            if existing:
                existing.title = cert_in.title
                existing.description = cert_in.description
                existing.issuer = cert_in.issuer
                existing.external_code = cert_in.external_code
                existing.validity_months = cert_in.validity_months
                updated["certifications"] += 1
            else:
                cert = TrainingCertification(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    slug=cert_in.slug,
                    title=cert_in.title,
                    description=cert_in.description,
                    issuer=cert_in.issuer,
                    external_code=cert_in.external_code,
                    validity_months=cert_in.validity_months,
                )
                self.db.add(cert)
                cert_by_slug[cert_in.slug] = cert
                created["certifications"] += 1
            stats["certifications"] += 1

        for course_in in pack.courses:
            self._upsert_course(
                course_in,
                cert_by_slug=cert_by_slug,
                deck_version=pack.version,
                stats=stats,
                created=created,
                updated=updated,
                skipped=skipped,
            )

        batch = TrainingImportBatch(
            id=str(uuid.uuid4()),
            company_id=self.company_id,
            source_name=pack.source_name,
            import_version=pack.version,
            status="completed",
            stats={**stats, "created": created, "updated": updated, "skipped": skipped},
            created_by_user_id=self.user_id,
        )
        self.db.add(batch)
        self.db.flush()

        return TrainingImportResultOut(
            batch_id=batch.id,
            source_name=pack.source_name,
            status="completed",
            stats=stats,
            created=created,
            updated=updated,
            skipped=skipped,
            warnings=[TrainingImportIssueOut(**w.to_dict()) for w in validation.warnings],
            errors=[],
        )

    def _load_certifications_by_slug(self) -> dict[str, TrainingCertification]:
        rows = self.db.execute(
            select(TrainingCertification).where(TrainingCertification.company_id == self.company_id)
        ).scalars().all()
        return {c.slug: c for c in rows}

    def _upsert_course(
        self,
        course_in: Any,
        *,
        cert_by_slug: dict[str, TrainingCertification],
        deck_version: str,
        stats: dict[str, int],
        created: dict[str, int],
        updated: dict[str, int],
        skipped: dict[str, int],
    ) -> None:
        certification_id = None
        if course_in.certification_slug:
            cert = cert_by_slug.get(course_in.certification_slug)
            certification_id = str(cert.id) if cert else None

        existing_course = self.db.execute(
            select(TrainingCourse).where(
                TrainingCourse.company_id == self.company_id,
                TrainingCourse.slug == course_in.slug,
            )
        ).scalar_one_or_none()

        if existing_course:
            course = existing_course
            course.title = course_in.title
            course.description = course_in.description
            course.course_kind = course_in.course_kind
            course.completion_threshold_pct = course_in.completion_threshold_pct
            course.estimated_hours = course_in.estimated_hours
            course.tags = course_in.tags
            course.certification_id = certification_id
            course.status = TrainingCourseStatus.published.value
            set_deck_version_on_course(course, deck_version)
            updated["courses"] += 1
        else:
            course = TrainingCourse(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                certification_id=certification_id,
                slug=course_in.slug,
                title=course_in.title,
                description=course_in.description,
                course_kind=course_in.course_kind,
                status=TrainingCourseStatus.published.value,
                completion_threshold_pct=course_in.completion_threshold_pct,
                estimated_hours=course_in.estimated_hours,
                tags=course_in.tags,
                created_by_user_id=self.user_id,
            )
            self.db.add(course)
            self.db.flush()
            set_deck_version_on_course(course, deck_version)
            created["courses"] += 1
        stats["courses"] += 1
        course_id = str(course.id)

        card_index = self._load_flashcard_index(course_id)

        for edge in course_in.knowledge_edges:
            self._add_edge(edge.model_dump(), stats, created)

        for section_in in course_in.sections:
            self._upsert_section(
                section_in,
                course_id=course_id,
                card_index=card_index,
                stats=stats,
                created=created,
                updated=updated,
                skipped=skipped,
            )

        if course_in.flashcards:
            holder_lesson_id = self._ensure_course_level_lesson(course_id, course_in.slug)
            for fc in course_in.flashcards:
                self._upsert_flashcard(
                    fc,
                    course_id=course_id,
                    lesson_id=holder_lesson_id,
                    card_index=card_index,
                    stats=stats,
                    created=created,
                    updated=updated,
                )

        for quiz_in in course_in.quizzes:
            self._add_quiz(quiz_in.model_dump(), course_id=course_id, lesson_id=None, stats=stats, created=created)
        if course_in.final_exam:
            data = course_in.final_exam.model_dump()
            data["quiz_kind"] = "final_exam"
            self._add_quiz(data, course_id=course_id, lesson_id=None, stats=stats, created=created)

    def _load_flashcard_index(self, course_id: str) -> dict[str, Any]:
        """import_id -> row; also prompt keys per lesson for fallback matching."""
        rows = self.db.execute(
            select(TrainingFlashcard).where(
                TrainingFlashcard.company_id == self.company_id,
                TrainingFlashcard.course_id == course_id,
            )
        ).scalars().all()
        by_import_id: dict[str, TrainingFlashcard] = {}
        by_lesson_prompt: dict[tuple[str | None, str], TrainingFlashcard] = {}
        for row in rows:
            meta = row.metadata_ or {}
            import_id = meta.get(_IMPORT_ID_META_KEY)
            if import_id:
                by_import_id[str(import_id)] = row
            prompt_key = self._norm_prompt(row.prompt)
            by_lesson_prompt[(str(row.lesson_id) if row.lesson_id else None, prompt_key)] = row
        return {"by_import_id": by_import_id, "by_lesson_prompt": by_lesson_prompt}

    @staticmethod
    def _norm_prompt(prompt: str) -> str:
        return " ".join((prompt or "").strip().lower().split())

    def _upsert_section(
        self,
        section_in: TrainingImportSectionIn,
        *,
        course_id: str,
        card_index: dict[str, Any],
        stats: dict[str, int],
        created: dict[str, int],
        updated: dict[str, int],
        skipped: dict[str, int],
    ) -> None:
        existing = self.db.execute(
            select(TrainingSection).where(
                TrainingSection.company_id == self.company_id,
                TrainingSection.course_id == course_id,
                TrainingSection.slug == section_in.slug,
            )
        ).scalar_one_or_none()

        if existing:
            section = existing
            section.title = section_in.title
            section.description = section_in.description
            updated["sections"] += 1
        else:
            section = TrainingSection(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                course_id=course_id,
                slug=section_in.slug,
                title=section_in.title,
                description=section_in.description,
                sort_order=stats["sections"],
            )
            self.db.add(section)
            self.db.flush()
            created["sections"] += 1
        stats["sections"] += 1
        section_id = str(section.id)

        if section_in.flashcards:
            holder_lesson_id = self._ensure_section_flashcard_lesson(
                course_id=course_id,
                section_id=section_id,
                section_slug=section_in.slug,
                section_title=section_in.title,
                stats=stats,
                created=created,
                updated=updated,
            )
            for fc in section_in.flashcards:
                self._upsert_flashcard(
                    fc,
                    course_id=course_id,
                    lesson_id=holder_lesson_id,
                    card_index=card_index,
                    stats=stats,
                    created=created,
                    updated=updated,
                )

        for lesson_in in section_in.lessons:
            existing_lesson = self.db.execute(
                select(TrainingLesson).where(
                    TrainingLesson.company_id == self.company_id,
                    TrainingLesson.section_id == section_id,
                    TrainingLesson.slug == lesson_in.slug,
                )
            ).scalar_one_or_none()

            if existing_lesson:
                lesson = existing_lesson
                lesson.title = lesson_in.title
                lesson.summary = lesson_in.summary
                lesson.content_markdown = lesson_in.content_markdown
                lesson.tags = lesson_in.tags
                lesson.estimated_minutes = lesson_in.estimated_minutes
                updated["lessons"] += 1
            else:
                lesson = TrainingLesson(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    course_id=course_id,
                    section_id=section_id,
                    slug=lesson_in.slug,
                    title=lesson_in.title,
                    summary=lesson_in.summary,
                    content_markdown=lesson_in.content_markdown,
                    tags=lesson_in.tags,
                    estimated_minutes=lesson_in.estimated_minutes,
                    sort_order=stats["lessons"],
                )
                self.db.add(lesson)
                self.db.flush()
                created["lessons"] += 1
            stats["lessons"] += 1
            lesson_id = str(lesson.id)

            for fc in lesson_in.flashcards:
                self._upsert_flashcard(
                    fc,
                    course_id=course_id,
                    lesson_id=lesson_id,
                    card_index=card_index,
                    stats=stats,
                    created=created,
                    updated=updated,
                )
            for quiz_in in lesson_in.quizzes:
                self._add_quiz(quiz_in.model_dump(), course_id=course_id, lesson_id=lesson_id, stats=stats, created=created)
            for edge in lesson_in.knowledge_edges:
                self._add_edge(edge.model_dump(), stats, created)

    def _ensure_section_flashcard_lesson(
        self,
        *,
        course_id: str,
        section_id: str,
        section_slug: str,
        section_title: str,
        stats: dict[str, int],
        created: dict[str, int],
        updated: dict[str, int],
    ) -> str:
        lesson_slug = f"{section_slug}{_SECTION_FLASHCARD_LESSON_SUFFIX}"
        existing = self.db.execute(
            select(TrainingLesson).where(
                TrainingLesson.company_id == self.company_id,
                TrainingLesson.section_id == section_id,
                TrainingLesson.slug == lesson_slug,
            )
        ).scalar_one_or_none()
        if existing:
            return str(existing.id)

        lesson = TrainingLesson(
            id=str(uuid.uuid4()),
            company_id=self.company_id,
            course_id=course_id,
            section_id=section_id,
            slug=lesson_slug,
            title=f"{section_title} — Flashcards",
            summary="Auto-created holder for section flashcards",
            sort_order=stats["lessons"],
        )
        self.db.add(lesson)
        self.db.flush()
        stats["lessons"] += 1
        created["lessons"] += 1
        return str(lesson.id)

    def _ensure_course_level_lesson(self, course_id: str, course_slug: str) -> str:
        """Synthetic section/lesson for course-level flashcards."""
        section_slug = "__course_flashcards__"
        section = self.db.execute(
            select(TrainingSection).where(
                TrainingSection.company_id == self.company_id,
                TrainingSection.course_id == course_id,
                TrainingSection.slug == section_slug,
            )
        ).scalar_one_or_none()
        if not section:
            section = TrainingSection(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                course_id=course_id,
                slug=section_slug,
                title="Course flashcards",
                sort_order=9999,
            )
            self.db.add(section)
            self.db.flush()

        lesson_slug = f"{course_slug}{_SECTION_FLASHCARD_LESSON_SUFFIX}"
        lesson = self.db.execute(
            select(TrainingLesson).where(
                TrainingLesson.company_id == self.company_id,
                TrainingLesson.section_id == str(section.id),
                TrainingLesson.slug == lesson_slug,
            )
        ).scalar_one_or_none()
        if lesson:
            return str(lesson.id)

        lesson = TrainingLesson(
            id=str(uuid.uuid4()),
            company_id=self.company_id,
            course_id=course_id,
            section_id=str(section.id),
            slug=lesson_slug,
            title="Course flashcards",
            sort_order=0,
        )
        self.db.add(lesson)
        self.db.flush()
        return str(lesson.id)

    def _upsert_flashcard(
        self,
        fc: TrainingImportFlashcardIn,
        *,
        course_id: str,
        lesson_id: str | None,
        card_index: dict[str, Any],
        stats: dict[str, int],
        created: dict[str, int],
        updated: dict[str, int],
    ) -> None:
        by_import_id: dict[str, TrainingFlashcard] = card_index["by_import_id"]
        by_lesson_prompt: dict[tuple[str | None, str], TrainingFlashcard] = card_index["by_lesson_prompt"]

        existing: TrainingFlashcard | None = None
        if fc.id:
            existing = by_import_id.get(fc.id.strip())
        if existing is None:
            prompt_key = self._norm_prompt(fc.prompt)
            existing = by_lesson_prompt.get((lesson_id, prompt_key))

        meta = dict(existing.metadata_ or {}) if existing else {}
        if fc.id:
            meta[_IMPORT_ID_META_KEY] = fc.id.strip()

        if existing:
            existing.prompt = fc.prompt
            existing.answer = fc.answer
            existing.explanation = fc.explanation
            existing.card_type = fc.card_type
            existing.difficulty = fc.difficulty
            existing.tags = fc.tags
            existing.options = merge_flashcard_option_fields(existing.options, fc.options)
            existing.lesson_id = lesson_id
            existing.metadata_ = meta
            existing.is_active = True
            updated["flashcards"] += 1
        else:
            card = TrainingFlashcard(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                course_id=course_id,
                lesson_id=lesson_id,
                card_type=fc.card_type,
                prompt=fc.prompt,
                answer=fc.answer,
                explanation=fc.explanation,
                difficulty=fc.difficulty,
                tags=fc.tags,
                options=fc.options,
                metadata_=meta,
                sort_order=stats["flashcards"],
            )
            self.db.add(card)
            self.db.flush()
            if fc.id:
                by_import_id[fc.id.strip()] = card
            by_lesson_prompt[(lesson_id, self._norm_prompt(fc.prompt))] = card
            created["flashcards"] += 1
        stats["flashcards"] += 1

    def _add_quiz(
        self,
        data: dict[str, Any],
        *,
        course_id: str,
        lesson_id: str | None,
        stats: dict[str, int],
        created: dict[str, int],
    ) -> None:
        quiz_id = str(uuid.uuid4())
        quiz = TrainingQuiz(
            id=quiz_id,
            company_id=self.company_id,
            course_id=course_id,
            lesson_id=lesson_id,
            title=data["title"],
            quiz_kind=data.get("quiz_kind", "practice"),
            passing_score_pct=data.get("passing_score_pct", 70),
            time_limit_minutes=data.get("time_limit_minutes"),
            sort_order=stats["quizzes"],
        )
        self.db.add(quiz)
        stats["quizzes"] += 1
        created["quizzes"] += 1

        for q in data.get("questions", []):
            question = TrainingQuestion(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                quiz_id=quiz_id,
                question_type=q.get("question_type", "multiple_choice"),
                prompt=q["prompt"],
                explanation=q.get("explanation"),
                options=q.get("options", {}),
                correct_answer=q.get("correct_answer", {}),
                points=q.get("points", 1),
                difficulty=q.get("difficulty", 3),
                tags=q.get("tags", []),
                sort_order=stats["questions"],
            )
            self.db.add(question)
            stats["questions"] += 1
            created["questions"] += 1

    def _add_edge(self, edge: dict[str, Any], stats: dict[str, int], created: dict[str, int]) -> None:
        row = TrainingKnowledgeEdge(
            id=str(uuid.uuid4()),
            company_id=self.company_id,
            source_kind=edge["source_kind"],
            source_id=edge["source_id"],
            target_kind=edge["target_kind"],
            target_id=edge["target_id"],
            relation_kind=edge.get("relation_kind", "relates_to"),
            label=edge.get("label"),
            metadata_=edge.get("metadata", {}),
        )
        self.db.add(row)
        stats["knowledge_edges"] += 1
        created["knowledge_edges"] += 1


def validation_failure_result(pack_source: str, validation: ImportValidationResult) -> TrainingImportResultOut:
    return TrainingImportResultOut(
        batch_id=None,
        source_name=pack_source,
        status="failed_validation",
        errors=[TrainingImportIssueOut(**e.to_dict()) for e in validation.errors],
        warnings=[TrainingImportIssueOut(**w.to_dict()) for w in validation.warnings],
    )
