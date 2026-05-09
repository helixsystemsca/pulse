"""Procedure verification: engagement tracking, quiz attempts, optional quiz JSON on procedures."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0110_procedure_verification"
down_revision = "0109_inventory_vendors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column("verification_quiz", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "pulse_procedure_compliance_settings",
        sa.Column(
            "requires_knowledge_verification",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    op.create_table(
        "pulse_procedure_engagement",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("employee_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("procedure_id", UUID(as_uuid=False), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("first_viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_view_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quiz_passed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["procedure_id"], ["pulse_procedures.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            "revision_number",
            name="uq_pulse_proc_engagement_emp_proc_rev",
        ),
    )
    op.create_index(
        "ix_pulse_proc_engagement_company_employee",
        "pulse_procedure_engagement",
        ["company_id", "employee_user_id"],
    )

    op.create_table(
        "pulse_procedure_quiz_sessions",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("employee_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("procedure_id", UUID(as_uuid=False), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("question_order", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["procedure_id"], ["pulse_procedures.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_pulse_proc_quiz_sess_company_user_proc",
        "pulse_procedure_quiz_sessions",
        ["company_id", "employee_user_id", "procedure_id"],
    )

    op.create_table(
        "pulse_procedure_quiz_attempts",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("employee_user_id", UUID(as_uuid=False), nullable=False),
        sa.Column("procedure_id", UUID(as_uuid=False), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("score_percent", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("answers_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("reveal_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["procedure_id"], ["pulse_procedures.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_pulse_proc_quiz_attempt_company_user_proc",
        "pulse_procedure_quiz_attempts",
        ["company_id", "employee_user_id", "procedure_id"],
    )

    # Backfill engagement + quiz_passed_at from existing completion sign-offs (numeric revision_marker only).
    op.execute(
        """
        INSERT INTO pulse_procedure_engagement (
            id, company_id, employee_user_id, procedure_id, revision_number,
            first_viewed_at, last_viewed_at, total_view_seconds, quiz_passed_at
        )
        SELECT gen_random_uuid(), s.company_id, s.employee_user_id, s.procedure_id,
               CAST(NULLIF(trim(s.revision_marker), '') AS INTEGER),
               s.completed_at, s.completed_at, 0, s.completed_at
        FROM pulse_procedure_completion_signoffs s
        WHERE s.revision_marker ~ '^[0-9]+$'
          AND CAST(s.revision_marker AS INTEGER) > 0
        ON CONFLICT ON CONSTRAINT uq_pulse_proc_engagement_emp_proc_rev DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_proc_quiz_attempt_company_user_proc", table_name="pulse_procedure_quiz_attempts")
    op.drop_table("pulse_procedure_quiz_attempts")
    op.drop_index("ix_pulse_proc_quiz_sess_company_user_proc", table_name="pulse_procedure_quiz_sessions")
    op.drop_table("pulse_procedure_quiz_sessions")
    op.drop_index("ix_pulse_proc_engagement_company_employee", table_name="pulse_procedure_engagement")
    op.drop_table("pulse_procedure_engagement")
    op.drop_column("pulse_procedure_compliance_settings", "requires_knowledge_verification")
    op.drop_column("pulse_procedures", "verification_quiz")
