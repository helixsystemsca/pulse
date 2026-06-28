"""Helix Training Platform — courses, flashcards, certifications, knowledge graph."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1041_training_platform"
down_revision = "1040_op_improvement_framework"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_create_table(
        op,
        conn,
        "training_certifications",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(96), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("issuer", sa.String(255), nullable=True),
        sa.Column("external_code", sa.String(64), nullable=True),
        sa.Column("validity_months", sa.Integer(), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "slug", name="uq_training_certifications_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_training_certifications_company_id", "training_certifications", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_courses",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "certification_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_certifications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("course_kind", sa.String(32), nullable=False, server_default="internal"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("completion_threshold_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("estimated_hours", sa.Float(), nullable=True),
        sa.Column("certificate_template", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "slug", name="uq_training_courses_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_training_courses_company_id", "training_courses", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_courses_certification_id", "training_courses", ["certification_id"])
    ah.safe_create_index(op, conn, "ix_training_courses_procedure_id", "training_courses", ["procedure_id"])
    ah.safe_create_index(op, conn, "ix_training_courses_status", "training_courses", ["status"])

    ah.safe_create_table(
        op,
        conn,
        "training_sections",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_section_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_sections.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("course_id", "slug", name="uq_training_sections_course_slug"),
    )
    ah.safe_create_index(op, conn, "ix_training_sections_company_id", "training_sections", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_sections_course_id", "training_sections", ["course_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_lessons",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "section_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_sections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("content_markdown", sa.Text(), nullable=True),
        sa.Column("content_html", sa.Text(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("section_id", "slug", name="uq_training_lessons_section_slug"),
    )
    ah.safe_create_index(op, conn, "ix_training_lessons_company_id", "training_lessons", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_lessons_course_id", "training_lessons", ["course_id"])
    ah.safe_create_index(op, conn, "ix_training_lessons_section_id", "training_lessons", ["section_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_flashcards",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "lesson_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_lessons.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("card_type", sa.String(32), nullable=False, server_default="flashcard"),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("options", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_flashcards_company_id", "training_flashcards", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_flashcards_course_id", "training_flashcards", ["course_id"])
    ah.safe_create_index(op, conn, "ix_training_flashcards_lesson_id", "training_flashcards", ["lesson_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_review_history",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "flashcard_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_flashcards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ease_factor", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("last_rating", sa.String(16), nullable=True),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_log", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "user_id", "flashcard_id", name="uq_training_review_user_card"),
    )
    ah.safe_create_index(op, conn, "ix_training_review_history_company_id", "training_review_history", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_review_history_user_id", "training_review_history", ["user_id"])
    ah.safe_create_index(op, conn, "ix_training_review_history_flashcard_id", "training_review_history", ["flashcard_id"])
    ah.safe_create_index(op, conn, "ix_training_review_history_next_review", "training_review_history", ["next_review_at"])

    ah.safe_create_table(
        op,
        conn,
        "training_quizzes",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "lesson_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_lessons.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("quiz_kind", sa.String(32), nullable=False, server_default="practice"),
        sa.Column("passing_score_pct", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_quizzes_company_id", "training_quizzes", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_quizzes_course_id", "training_quizzes", ["course_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_questions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "quiz_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_quizzes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_type", sa.String(32), nullable=False, server_default="multiple_choice"),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("options", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("correct_answer", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("points", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_questions_company_id", "training_questions", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_questions_quiz_id", "training_questions", ["quiz_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_learning_paths",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "certification_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_certifications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "slug", name="uq_training_learning_paths_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_training_learning_paths_company_id", "training_learning_paths", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_learning_path_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "learning_path_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_learning_paths.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "lesson_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_lessons.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "quiz_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_quizzes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    ah.safe_create_index(
        op, conn, "ix_training_learning_path_items_path_id", "training_learning_path_items", ["learning_path_id"]
    )

    ah.safe_create_table(
        op,
        conn,
        "training_user_progress",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_kind", sa.String(32), nullable=False),
        sa.Column("scope_id", UUID(as_uuid=False), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "lesson_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_lessons.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "learning_path_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_learning_paths.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="not_started"),
        sa.Column("progress_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("knowledge_score", sa.Float(), nullable=True),
        sa.Column("study_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("weak_topics", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint(
            "company_id", "user_id", "scope_kind", "scope_id", name="uq_training_user_progress_scope"
        ),
    )
    ah.safe_create_index(op, conn, "ix_training_user_progress_company_id", "training_user_progress", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_user_progress_user_id", "training_user_progress", ["user_id"])
    ah.safe_create_index(op, conn, "ix_training_user_progress_due_at", "training_user_progress", ["due_at"])

    ah.safe_create_table(
        op,
        conn,
        "training_records",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("record_kind", sa.String(32), nullable=False),
        sa.Column(
            "course_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_courses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "certification_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_certifications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "quiz_id",
            UUID(as_uuid=False),
            sa.ForeignKey("training_quizzes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("score_pct", sa.Float(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
        sa.Column("certificate_issued", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("certificate_url", sa.String(1024), nullable=True),
        sa.Column("completed_on", sa.Date(), nullable=False),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_records_company_id", "training_records", ["company_id"])
    ah.safe_create_index(op, conn, "ix_training_records_user_id", "training_records", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "training_knowledge_edges",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_kind", sa.String(32), nullable=False),
        sa.Column("source_id", sa.String(64), nullable=False),
        sa.Column("target_kind", sa.String(32), nullable=False),
        sa.Column("target_id", sa.String(64), nullable=False),
        sa.Column("relation_kind", sa.String(32), nullable=False, server_default="relates_to"),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_knowledge_edges_company_id", "training_knowledge_edges", ["company_id"])
    ah.safe_create_index(
        op,
        conn,
        "ix_training_knowledge_edges_source",
        "training_knowledge_edges",
        ["source_kind", "source_id"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_training_knowledge_edges_target",
        "training_knowledge_edges",
        ["target_kind", "target_id"],
    )

    ah.safe_create_table(
        op,
        conn,
        "training_import_batches",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_name", sa.String(255), nullable=False),
        sa.Column("import_version", sa.String(64), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="completed"),
        sa.Column("stats", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_training_import_batches_company_id", "training_import_batches", ["company_id"])


def downgrade() -> None:
    conn = op.get_bind()
    tables = [
        "training_import_batches",
        "training_knowledge_edges",
        "training_records",
        "training_user_progress",
        "training_learning_path_items",
        "training_learning_paths",
        "training_questions",
        "training_quizzes",
        "training_review_history",
        "training_flashcards",
        "training_lessons",
        "training_sections",
        "training_courses",
        "training_certifications",
    ]
    for table in tables:
        ah.safe_drop_table(op, conn, table)
