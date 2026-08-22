"""Daily Operations Planner — rhythm, inbox, schedule, delays, time, analytics."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1050_daily_planner"
down_revision = "1049_ops_organization"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
_OBJ = sa.text("'{}'::jsonb")
_EMPTY = sa.text("'[]'::jsonb")


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_create_table(
        op,
        conn,
        "planner_categories",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("color", sa.String(16), nullable=False, server_default="#64748b"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "slug", name="uq_planner_categories_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_planner_categories_company_id", "planner_categories", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_settings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("work_start", sa.Time(), nullable=False, server_default=sa.text("'06:00'")),
        sa.Column("work_end", sa.Time(), nullable=False, server_default=sa.text("'16:30'")),
        sa.Column("category_targets", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("scheduler_weights", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("adaptive_scheduling", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="America/Vancouver"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "user_id", name="uq_planner_settings_user"),
    )
    ah.safe_create_index(op, conn, "ix_planner_settings_company_id", "planner_settings", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_settings_user_id", "planner_settings", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_routine_blocks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=False), sa.ForeignKey("planner_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("recurrence", sa.String(32), nullable=False, server_default="weekdays"),
        sa.Column("protected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("flexible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("min_minutes", sa.Integer(), nullable=True),
        sa.Column("max_minutes", sa.Integer(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_routine_blocks_company_id", "planner_routine_blocks", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_routine_blocks_user_id", "planner_routine_blocks", ["user_id"])
    ah.safe_create_index(op, conn, "ix_planner_routine_blocks_category_id", "planner_routine_blocks", ["category_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_tasks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", UUID(as_uuid=False), sa.ForeignKey("planner_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("tags", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("priority_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("source_type", sa.String(64), nullable=False, server_default="manual"),
        sa.Column("source_id", sa.String(128), nullable=True),
        sa.Column("project_id", sa.String(64), nullable=True),
        sa.Column("asset_id", sa.String(64), nullable=True),
        sa.Column("person_label", sa.String(255), nullable=True),
        sa.Column("recurrence", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="not_started"),
        sa.Column("delay_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_tasks_company_id", "planner_tasks", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_tasks_user_id", "planner_tasks", ["user_id"])
    ah.safe_create_index(op, conn, "ix_planner_tasks_category_id", "planner_tasks", ["category_id"])
    ah.safe_create_index(op, conn, "ix_planner_tasks_status", "planner_tasks", ["status"])

    ah.safe_create_table(
        op,
        conn,
        "planner_calendar_events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False, server_default="internal"),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_calendar_events_company_id", "planner_calendar_events", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_calendar_events_user_id", "planner_calendar_events", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_interruptions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=False), sa.ForeignKey("planner_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("paused_task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(64), nullable=False, server_default="emergency"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("create_work_request", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_interruptions_company_id", "planner_interruptions", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_interruptions_user_id", "planner_interruptions", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_blockers",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blocker_type", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("responsible_party", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    ah.safe_create_index(op, conn, "ix_planner_blockers_company_id", "planner_blockers", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_blockers_task_id", "planner_blockers", ["task_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_schedule_blocks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "calendar_event_id",
            UUID(as_uuid=False),
            sa.ForeignKey("planner_calendar_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "routine_block_id",
            UUID(as_uuid=False),
            sa.ForeignKey("planner_routine_blocks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "interruption_id",
            UUID(as_uuid=False),
            sa.ForeignKey("planner_interruptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("category_id", UUID(as_uuid=False), sa.ForeignKey("planner_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("block_type", sa.String(32), nullable=False, server_default="task"),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("generated_by_scheduler", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_schedule_blocks_company_id", "planner_schedule_blocks", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_schedule_blocks_user_id", "planner_schedule_blocks", ["user_id"])
    ah.safe_create_index(op, conn, "ix_planner_schedule_blocks_date", "planner_schedule_blocks", ["date"])
    ah.safe_create_index(op, conn, "ix_planner_schedule_blocks_task_id", "planner_schedule_blocks", ["task_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_task_history",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("previous_date", sa.Date(), nullable=True),
        sa.Column("previous_start", sa.Time(), nullable=True),
        sa.Column("new_date", sa.Date(), nullable=True),
        sa.Column("new_start", sa.Time(), nullable=True),
        sa.Column("reason", sa.String(64), nullable=False),
        sa.Column("source", sa.String(64), nullable=False, server_default="scheduler"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_task_history_company_id", "planner_task_history", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_task_history_task_id", "planner_task_history", ["task_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_time_entries",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "interruption_id",
            UUID(as_uuid=False),
            sa.ForeignKey("planner_interruptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_planner_time_entries_company_id", "planner_time_entries", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_time_entries_user_id", "planner_time_entries", ["user_id"])
    ah.safe_create_index(op, conn, "ix_planner_time_entries_task_id", "planner_time_entries", ["task_id"])

    ah.safe_create_table(
        op,
        conn,
        "planner_daily_metrics",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scheduled_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delayed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("interruption_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("meeting_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("strategic_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("category_minutes", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("delay_reasons", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "user_id", "date", name="uq_planner_daily_metrics_day"),
    )
    ah.safe_create_index(op, conn, "ix_planner_daily_metrics_company_id", "planner_daily_metrics", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planner_daily_metrics_user_id", "planner_daily_metrics", ["user_id"])


def downgrade() -> None:
    for table in [
        "planner_daily_metrics",
        "planner_time_entries",
        "planner_task_history",
        "planner_schedule_blocks",
        "planner_blockers",
        "planner_interruptions",
        "planner_calendar_events",
        "planner_tasks",
        "planner_routine_blocks",
        "planner_settings",
        "planner_categories",
    ]:
        op.execute(sa.text(f"DROP TABLE IF EXISTS {table} CASCADE"))
