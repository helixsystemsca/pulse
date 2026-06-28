"""
Helix Training Platform — courses, spaced repetition, certifications, knowledge graph.

Extends (does not replace) procedure-centric training in pulse_models.py.
Procedure links: optional procedure_id on courses, lessons, flashcards, quizzes, records.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums (stored as String columns for migration simplicity)
# ---------------------------------------------------------------------------


class TrainingCourseStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class TrainingCourseKind(str, enum.Enum):
    certification = "certification"
    onboarding = "onboarding"
    compliance = "compliance"
    procedure = "procedure"
    internal = "internal"
    safety = "safety"


class TrainingFlashcardType(str, enum.Enum):
    flashcard = "flashcard"
    multiple_choice = "multiple_choice"
    true_false = "true_false"
    ordering = "ordering"
    fill_blank = "fill_blank"
    scenario = "scenario"
    matching = "matching"


class TrainingReviewRating(str, enum.Enum):
    again = "again"
    unsure = "unsure"
    good = "good"
    easy = "easy"


class TrainingQuizKind(str, enum.Enum):
    practice = "practice"
    lesson = "lesson"
    final_exam = "final_exam"
    knowledge_check = "knowledge_check"


class TrainingQuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    true_false = "true_false"
    ordering = "ordering"
    fill_blank = "fill_blank"
    scenario = "scenario"
    matching = "matching"
    short_answer = "short_answer"


class TrainingProgressStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class TrainingRecordKind(str, enum.Enum):
    course_completion = "course_completion"
    certification_earned = "certification_earned"
    exam_pass = "exam_pass"
    procedure_signoff = "procedure_signoff"
    lesson_complete = "lesson_complete"


class TrainingKnowledgeEntityKind(str, enum.Enum):
    course = "course"
    section = "section"
    lesson = "lesson"
    flashcard = "flashcard"
    quiz = "quiz"
    question = "question"
    procedure = "procedure"
    concept = "concept"


class TrainingKnowledgeRelationKind(str, enum.Enum):
    relates_to = "relates_to"
    prerequisite = "prerequisite"
    part_of = "part_of"
    expands = "expands"
    assessed_by = "assessed_by"
    references = "references"


# ---------------------------------------------------------------------------
# Certification catalog (CAPM, FMP, internal, safety, …)
# ---------------------------------------------------------------------------


class TrainingCertification(Base):
    """Certification program definition (tenant-scoped; import seeds per org)."""

    __tablename__ = "training_certifications"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_training_certifications_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(96), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issuer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    validity_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    courses: Mapped[list["TrainingCourse"]] = relationship(back_populates="certification")


# ---------------------------------------------------------------------------
# Courses → sections → lessons
# ---------------------------------------------------------------------------


class TrainingCourse(Base):
    __tablename__ = "training_courses"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_training_courses_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certification_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_certifications.id", ondelete="SET NULL"), nullable=True, index=True
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    course_kind: Mapped[str] = mapped_column(String(32), nullable=False, default=TrainingCourseKind.internal.value)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=TrainingCourseStatus.draft.value)
    completion_threshold_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    certificate_template: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    certification: Mapped[Optional["TrainingCertification"]] = relationship(back_populates="courses")
    sections: Mapped[list["TrainingSection"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="TrainingSection.sort_order"
    )
    flashcards: Mapped[list["TrainingFlashcard"]] = relationship(back_populates="course")
    quizzes: Mapped[list["TrainingQuiz"]] = relationship(back_populates="course")


class TrainingSection(Base):
    __tablename__ = "training_sections"
    __table_args__ = (
        UniqueConstraint("course_id", "slug", name="uq_training_sections_course_slug"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_section_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    course: Mapped["TrainingCourse"] = relationship(back_populates="sections")
    lessons: Mapped[list["TrainingLesson"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", order_by="TrainingLesson.sort_order"
    )


class TrainingLesson(Base):
    __tablename__ = "training_lessons"
    __table_args__ = (
        UniqueConstraint("section_id", "slug", name="uq_training_lessons_section_slug"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_markdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    section: Mapped["TrainingSection"] = relationship(back_populates="lessons")
    flashcards: Mapped[list["TrainingFlashcard"]] = relationship(back_populates="lesson")
    quizzes: Mapped[list["TrainingQuiz"]] = relationship(back_populates="lesson")


# ---------------------------------------------------------------------------
# Flashcards + spaced repetition review history
# ---------------------------------------------------------------------------


class TrainingFlashcard(Base):
    __tablename__ = "training_flashcards"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_lessons.id", ondelete="CASCADE"), nullable=True, index=True
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    card_type: Mapped[str] = mapped_column(String(32), nullable=False, default=TrainingFlashcardType.flashcard.value)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    course: Mapped[Optional["TrainingCourse"]] = relationship(back_populates="flashcards")
    lesson: Mapped[Optional["TrainingLesson"]] = relationship(back_populates="flashcards")
    review_history: Mapped[list["TrainingReviewHistory"]] = relationship(
        back_populates="flashcard", cascade="all, delete-orphan"
    )


class TrainingReviewHistory(Base):
    """Per-user SM-2 state and review log for a flashcard."""

    __tablename__ = "training_review_history"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "flashcard_id", name="uq_training_review_user_card"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    flashcard_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_flashcards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_rating: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_log: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    flashcard: Mapped["TrainingFlashcard"] = relationship(back_populates="review_history")


# ---------------------------------------------------------------------------
# Quizzes + questions
# ---------------------------------------------------------------------------


class TrainingQuiz(Base):
    __tablename__ = "training_quizzes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_lessons.id", ondelete="CASCADE"), nullable=True, index=True
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    quiz_kind: Mapped[str] = mapped_column(String(32), nullable=False, default=TrainingQuizKind.practice.value)
    passing_score_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    course: Mapped[Optional["TrainingCourse"]] = relationship(back_populates="quizzes")
    lesson: Mapped[Optional["TrainingLesson"]] = relationship(back_populates="quizzes")
    questions: Mapped[list["TrainingQuestion"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", order_by="TrainingQuestion.sort_order"
    )


class TrainingQuestion(Base):
    __tablename__ = "training_questions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quiz_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TrainingQuestionType.multiple_choice.value
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    correct_answer: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    quiz: Mapped["TrainingQuiz"] = relationship(back_populates="questions")


# ---------------------------------------------------------------------------
# Learning paths
# ---------------------------------------------------------------------------


class TrainingLearningPath(Base):
    __tablename__ = "training_learning_paths"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_training_learning_paths_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certification_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_certifications.id", ondelete="SET NULL"), nullable=True, index=True
    )
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["TrainingLearningPathItem"]] = relationship(
        back_populates="learning_path", cascade="all, delete-orphan", order_by="TrainingLearningPathItem.sort_order"
    )


class TrainingLearningPathItem(Base):
    __tablename__ = "training_learning_path_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    learning_path_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_learning_paths.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_lessons.id", ondelete="CASCADE"), nullable=True, index=True
    )
    quiz_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_quizzes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")

    learning_path: Mapped["TrainingLearningPath"] = relationship(back_populates="items")


# ---------------------------------------------------------------------------
# User progress + training records (audit / certificates)
# ---------------------------------------------------------------------------


class TrainingUserProgress(Base):
    """Per-user progress for a course, lesson, or learning path."""

    __tablename__ = "training_user_progress"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "scope_kind", "scope_id", name="uq_training_user_progress_scope"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    course_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_lessons.id", ondelete="CASCADE"), nullable=True, index=True
    )
    learning_path_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_learning_paths.id", ondelete="CASCADE"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=TrainingProgressStatus.not_started.value)
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    knowledge_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    study_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weak_topics: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TrainingRecord(Base):
    """Immutable-style completion / certification audit row."""

    __tablename__ = "training_records"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    record_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    course_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_courses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    certification_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_certifications.id", ondelete="SET NULL"), nullable=True, index=True
    )
    procedure_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quiz_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("training_quizzes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    score_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    certificate_issued: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    certificate_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    completed_on: Mapped[date] = mapped_column(Date, nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


# ---------------------------------------------------------------------------
# Knowledge graph edges
# ---------------------------------------------------------------------------


class TrainingKnowledgeEdge(Base):
    """Directed relationships between lessons, flashcards, procedures, concepts."""

    __tablename__ = "training_knowledge_edges"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    relation_kind: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TrainingKnowledgeRelationKind.relates_to.value
    )
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


# ---------------------------------------------------------------------------
# JSON import batches
# ---------------------------------------------------------------------------


class TrainingImportBatch(Base):
    """Tracks bulk JSON imports (CAPM seed, course packs)."""

    __tablename__ = "training_import_batches"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    import_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="completed")
    stats: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
