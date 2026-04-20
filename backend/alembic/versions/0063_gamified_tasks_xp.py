"""Gamified tasks + XP: tasks, stats, events, reviews."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0063_gamified_tasks_xp"
down_revision = "0062_pm_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        # Tenant scoping (Supabase Postgres is multi-tenant in this app)
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "assigned_to",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", UUID(as_uuid=False), nullable=True),
        sa.Column(
            "equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="todo"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("priority >= 1", name="ck_tasks_priority_ge1"),
        sa.CheckConstraint("difficulty >= 1", name="ck_tasks_difficulty_ge1"),
        sa.CheckConstraint(
            "status IN ('todo','in_progress','done')",
            name="ck_tasks_status",
        ),
        sa.CheckConstraint(
            "source_type IN ('work_order','pm','project','routine','self')",
            name="ck_tasks_source_type",
        ),
    )
    op.create_index("ix_tasks_company_id", "tasks", ["company_id"])
    op.create_index("ix_tasks_assigned_to", "tasks", ["assigned_to"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    # Prevent duplicate upstream-sourced tasks.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_tasks_company_source_ref
        ON tasks (company_id, source_type, source_id)
        WHERE source_id IS NOT NULL
        """
    )

    op.create_table(
        "user_stats",
        sa.Column(
            "user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tasks_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("on_time_rate", sa.Float(), nullable=False, server_default="1"),
        sa.Column("avg_completion_time", sa.Float(), nullable=False, server_default="0"),
        sa.Column("streak", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("total_xp >= 0", name="ck_user_stats_total_xp_ge0"),
        sa.CheckConstraint("level >= 1", name="ck_user_stats_level_ge1"),
        sa.CheckConstraint("tasks_completed >= 0", name="ck_user_stats_tasks_completed_ge0"),
        sa.CheckConstraint("streak >= 0", name="ck_user_stats_streak_ge0"),
    )
    op.create_index("ix_user_stats_company_id", "user_stats", ["company_id"])

    op.create_table(
        "task_events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("xp_earned", sa.Integer(), nullable=False),
        sa.Column("completion_time", sa.Float(), nullable=False),
        sa.Column("was_late", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("xp_earned >= 0", name="ck_task_events_xp_ge0"),
        sa.CheckConstraint("completion_time >= 0", name="ck_task_events_completion_time_ge0"),
    )
    op.create_index("ix_task_events_company_id", "task_events", ["company_id"])
    op.create_index("ix_task_events_task_id", "task_events", ["task_id"])
    op.create_index("ix_task_events_user_id", "task_events", ["user_id"])
    op.create_index("ix_task_events_created_at", "task_events", ["created_at"])

    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "reviewer_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_1_5"),
        sa.CheckConstraint("type IN ('manager','peer')", name="ck_reviews_type"),
    )
    op.create_index("ix_reviews_company_id", "reviews", ["company_id"])
    op.create_index("ix_reviews_user_id", "reviews", ["user_id"])
    op.create_index("ix_reviews_reviewer_id", "reviews", ["reviewer_id"])
    op.create_index("ix_reviews_created_at", "reviews", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_reviews_created_at", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_id", table_name="reviews")
    op.drop_index("ix_reviews_user_id", table_name="reviews")
    op.drop_index("ix_reviews_company_id", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("ix_task_events_created_at", table_name="task_events")
    op.drop_index("ix_task_events_user_id", table_name="task_events")
    op.drop_index("ix_task_events_task_id", table_name="task_events")
    op.drop_index("ix_task_events_company_id", table_name="task_events")
    op.drop_table("task_events")

    op.drop_index("ix_user_stats_company_id", table_name="user_stats")
    op.drop_table("user_stats")

    op.execute("DROP INDEX IF EXISTS uq_tasks_company_source_ref")
    op.drop_index("ix_tasks_due_date", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_index("ix_tasks_assigned_to", table_name="tasks")
    op.drop_index("ix_tasks_company_id", table_name="tasks")
    op.drop_table("tasks")

