"""Pydantic schemas for the Helix Training Platform (courses, flashcards, certifications)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Shared literals (aligned with training_platform_models enums)
# ---------------------------------------------------------------------------

TrainingCourseStatusApi = Literal["draft", "published", "archived"]
TrainingCourseKindApi = Literal["certification", "onboarding", "compliance", "procedure", "internal", "safety"]
TrainingFlashcardTypeApi = Literal[
    "flashcard", "multiple_choice", "true_false", "ordering", "fill_blank", "scenario", "matching"
]
TrainingReviewRatingApi = Literal["again", "unsure", "good", "easy"]
TrainingQuizKindApi = Literal["practice", "lesson", "final_exam", "knowledge_check"]
TrainingQuestionTypeApi = Literal[
    "multiple_choice", "true_false", "ordering", "fill_blank", "scenario", "matching", "short_answer"
]
TrainingProgressStatusApi = Literal["not_started", "in_progress", "completed"]
TrainingRecordKindApi = Literal[
    "course_completion", "certification_earned", "exam_pass", "procedure_signoff", "lesson_complete"
]
TrainingKnowledgeEntityKindApi = Literal[
    "course", "section", "lesson", "flashcard", "quiz", "question", "procedure", "concept"
]
TrainingKnowledgeRelationKindApi = Literal["relates_to", "prerequisite", "part_of", "expands", "assessed_by", "references"]
TrainingProgressScopeKindApi = Literal["course", "lesson", "learning_path"]

# Future AI extension keys stored in metadata JSONB (not implemented yet).
TRAINING_AI_METADATA_KEYS = frozenset(
    {
        "ai_generated",
        "ai_source_lesson_id",
        "ai_prompt_version",
        "ai_weak_topic_tags",
        "ai_study_plan_id",
        "ai_tutor_session_id",
    }
)


class TrainingAiExtensionMeta(BaseModel):
    """Documented shape for optional AI metadata on courses, lessons, flashcards."""

    ai_generated: bool = False
    ai_source_lesson_id: Optional[str] = None
    ai_prompt_version: Optional[str] = None
    ai_weak_topic_tags: list[str] = Field(default_factory=list)
    ai_study_plan_id: Optional[str] = None
    ai_tutor_session_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Certification
# ---------------------------------------------------------------------------


class TrainingCertificationOut(BaseModel):
    id: str
    company_id: str
    slug: str
    title: str
    description: Optional[str] = None
    issuer: Optional[str] = None
    external_code: Optional[str] = None
    validity_months: Optional[int] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrainingCertificationCreate(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    issuer: Optional[str] = None
    external_code: Optional[str] = None
    validity_months: Optional[int] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Course hierarchy
# ---------------------------------------------------------------------------


class TrainingLessonOut(BaseModel):
    id: str
    company_id: str
    course_id: str
    section_id: str
    procedure_id: Optional[str] = None
    slug: str
    title: str
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    estimated_minutes: Optional[int] = None
    sort_order: int = 0
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class TrainingSectionOut(BaseModel):
    id: str
    company_id: str
    course_id: str
    parent_section_id: Optional[str] = None
    slug: str
    title: str
    description: Optional[str] = None
    sort_order: int = 0
    lessons: list[TrainingLessonOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TrainingCourseOut(BaseModel):
    id: str
    company_id: str
    certification_id: Optional[str] = None
    procedure_id: Optional[str] = None
    slug: str
    title: str
    description: Optional[str] = None
    course_kind: TrainingCourseKindApi = "internal"
    status: TrainingCourseStatusApi = "draft"
    completion_threshold_pct: int = 100
    estimated_hours: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    published_at: Optional[datetime] = None
    sections: list[TrainingSectionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TrainingCourseSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str] = None
    course_kind: TrainingCourseKindApi = "internal"
    status: TrainingCourseStatusApi = "draft"
    completion_threshold_pct: int = 100
    estimated_hours: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    procedure_id: Optional[str] = None
    published_at: Optional[datetime] = None
    progress_pct: Optional[int] = None
    progress_status: Optional[TrainingProgressStatusApi] = None


class TrainingCourseCreate(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    course_kind: TrainingCourseKindApi = "internal"
    certification_id: Optional[str] = None
    procedure_id: Optional[str] = None
    completion_threshold_pct: int = 100
    estimated_hours: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Flashcards + review
# ---------------------------------------------------------------------------


class TrainingFlashcardOut(BaseModel):
    id: str
    company_id: str
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    procedure_id: Optional[str] = None
    card_type: TrainingFlashcardTypeApi = "flashcard"
    prompt: str
    answer: str
    explanation: Optional[str] = None
    difficulty: int = 3
    tags: list[str] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0

    model_config = {"from_attributes": True}


class TrainingReviewHistoryOut(BaseModel):
    id: str
    flashcard_id: str
    ease_factor: float
    interval_days: int
    repetitions: int
    confidence: Optional[int] = None
    last_rating: Optional[TrainingReviewRatingApi] = None
    next_review_at: Optional[datetime] = None
    last_reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrainingFlashcardReviewSubmit(BaseModel):
    rating: TrainingReviewRatingApi
    reviewed_at: Optional[datetime] = None


class TrainingSm2StateOut(BaseModel):
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review_at: datetime
    confidence: int


# ---------------------------------------------------------------------------
# Quizzes
# ---------------------------------------------------------------------------


class TrainingQuestionOut(BaseModel):
    id: str
    quiz_id: str
    question_type: TrainingQuestionTypeApi
    prompt: str
    explanation: Optional[str] = None
    options: dict[str, Any] = Field(default_factory=dict)
    points: int = 1
    difficulty: int = 3
    tags: list[str] = Field(default_factory=list)
    sort_order: int = 0

    model_config = {"from_attributes": True}


class TrainingQuizOut(BaseModel):
    id: str
    company_id: str
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    procedure_id: Optional[str] = None
    title: str
    quiz_kind: TrainingQuizKindApi = "practice"
    passing_score_pct: int = 70
    time_limit_minutes: Optional[int] = None
    questions: list[TrainingQuestionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Learning paths, progress, records
# ---------------------------------------------------------------------------


class TrainingLearningPathItemOut(BaseModel):
    id: str
    learning_path_id: str
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    quiz_id: Optional[str] = None
    sort_order: int = 0
    is_required: bool = True

    model_config = {"from_attributes": True}


class TrainingLearningPathOut(BaseModel):
    id: str
    company_id: str
    certification_id: Optional[str] = None
    slug: str
    title: str
    description: Optional[str] = None
    is_published: bool = False
    items: list[TrainingLearningPathItemOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TrainingUserProgressOut(BaseModel):
    id: str
    user_id: str
    scope_kind: TrainingProgressScopeKindApi
    scope_id: str
    status: TrainingProgressStatusApi
    progress_pct: int = 0
    knowledge_score: Optional[float] = None
    study_streak_days: int = 0
    weak_topics: list[str] = Field(default_factory=list)
    due_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrainingProgressUpsertIn(BaseModel):
    scope_kind: TrainingProgressScopeKindApi
    scope_id: str
    status: TrainingProgressStatusApi
    progress_pct: int = Field(default=0, ge=0, le=100)


class TrainingStudyDueCardOut(BaseModel):
    flashcard: TrainingFlashcardOut
    review: Optional[TrainingReviewHistoryOut] = None


class TrainingStudyDueOut(BaseModel):
    cards: list[TrainingStudyDueCardOut] = Field(default_factory=list)
    due_count: int = 0


class TrainingCourseFlashcardsOut(BaseModel):
    course_id: str
    course_title: str
    cards: list[TrainingStudyDueCardOut] = Field(default_factory=list)
    total: int = 0


class TrainingRecordOut(BaseModel):
    id: str
    user_id: str
    record_kind: TrainingRecordKindApi
    course_id: Optional[str] = None
    certification_id: Optional[str] = None
    procedure_id: Optional[str] = None
    score_pct: Optional[float] = None
    passed: Optional[bool] = None
    certificate_issued: bool = False
    completed_on: date

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Knowledge graph
# ---------------------------------------------------------------------------


class TrainingKnowledgeEdgeOut(BaseModel):
    id: str
    source_kind: TrainingKnowledgeEntityKindApi
    source_id: str
    target_kind: TrainingKnowledgeEntityKindApi
    target_id: str
    relation_kind: TrainingKnowledgeRelationKindApi = "relates_to"
    label: Optional[str] = None

    model_config = {"from_attributes": True}


class TrainingKnowledgeEdgeCreate(BaseModel):
    source_kind: TrainingKnowledgeEntityKindApi
    source_id: str
    target_kind: TrainingKnowledgeEntityKindApi
    target_id: str
    relation_kind: TrainingKnowledgeRelationKindApi = "relates_to"
    label: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Dashboard aggregates (API contract for milestone 2+)
# ---------------------------------------------------------------------------


class TrainingDashboardOut(BaseModel):
    courses_in_progress: list[TrainingUserProgressOut] = Field(default_factory=list)
    training_due: list[TrainingUserProgressOut] = Field(default_factory=list)
    study_streak_days: int = 0
    knowledge_score: Optional[float] = None
    weak_topics: list[str] = Field(default_factory=list)
    recent_activity: list[TrainingRecordOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# JSON import format (CAPM and course packs)
# ---------------------------------------------------------------------------


class TrainingImportFlashcardIn(BaseModel):
    id: Optional[str] = Field(
        None,
        description="Stable import identifier for upsert (stored in flashcard metadata.import_id).",
    )
    slug: Optional[str] = None
    card_type: TrainingFlashcardTypeApi = "flashcard"
    prompt: str
    answer: str
    explanation: Optional[str] = None
    difficulty: int = 3
    tags: list[str] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)
    knowledge_edges: list[TrainingKnowledgeEdgeCreate] = Field(default_factory=list)


class TrainingImportQuestionIn(BaseModel):
    question_type: TrainingQuestionTypeApi = "multiple_choice"
    prompt: str
    explanation: Optional[str] = None
    options: dict[str, Any] = Field(default_factory=dict)
    correct_answer: dict[str, Any] = Field(default_factory=dict)
    points: int = 1
    difficulty: int = 3
    tags: list[str] = Field(default_factory=list)


class TrainingImportQuizIn(BaseModel):
    title: str
    quiz_kind: TrainingQuizKindApi = "practice"
    passing_score_pct: int = 70
    time_limit_minutes: Optional[int] = None
    questions: list[TrainingImportQuestionIn] = Field(default_factory=list)


class TrainingImportLessonIn(BaseModel):
    slug: str
    title: str
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    estimated_minutes: Optional[int] = None
    tags: list[str] = Field(default_factory=list)
    flashcards: list[TrainingImportFlashcardIn] = Field(default_factory=list)
    quizzes: list[TrainingImportQuizIn] = Field(default_factory=list)
    knowledge_edges: list[TrainingKnowledgeEdgeCreate] = Field(default_factory=list)
    procedure_slug: Optional[str] = Field(
        None, description="Optional link to existing pulse procedure by slug within tenant."
    )


class TrainingImportSectionIn(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    flashcards: list[TrainingImportFlashcardIn] = Field(default_factory=list)
    lessons: list[TrainingImportLessonIn] = Field(default_factory=list)


class TrainingImportCourseIn(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    course_kind: TrainingCourseKindApi = "certification"
    completion_threshold_pct: int = 100
    estimated_hours: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    certification_slug: Optional[str] = None
    sections: list[TrainingImportSectionIn] = Field(default_factory=list)
    flashcards: list[TrainingImportFlashcardIn] = Field(default_factory=list)
    quizzes: list[TrainingImportQuizIn] = Field(default_factory=list)
    final_exam: Optional[TrainingImportQuizIn] = None
    knowledge_edges: list[TrainingKnowledgeEdgeCreate] = Field(default_factory=list)


class TrainingImportCertificationIn(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    issuer: Optional[str] = None
    external_code: Optional[str] = None
    validity_months: Optional[int] = None


class TrainingImportPackIn(BaseModel):
    """Root document for bulk JSON import."""

    version: str = "1.0"
    source_name: str
    certifications: list[TrainingImportCertificationIn] = Field(default_factory=list)
    courses: list[TrainingImportCourseIn] = Field(default_factory=list)
    learning_paths: list[dict[str, Any]] = Field(default_factory=list)


class TrainingImportIssueOut(BaseModel):
    severity: Literal["error", "warning"]
    code: str
    path: str
    message: str


class TrainingImportResultOut(BaseModel):
    batch_id: Optional[str] = None
    source_name: str
    status: Literal["completed", "failed_validation"] = "completed"
    stats: dict[str, int] = Field(default_factory=dict)
    created: dict[str, int] = Field(default_factory=dict)
    updated: dict[str, int] = Field(default_factory=dict)
    skipped: dict[str, int] = Field(default_factory=dict)
    errors: list[TrainingImportIssueOut] = Field(default_factory=list)
    warnings: list[TrainingImportIssueOut] = Field(default_factory=list)
