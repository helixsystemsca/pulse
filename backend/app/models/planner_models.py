"""Daily Operations Planner ORM models."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PlannerCategory(Base):
    __tablename__ = "planner_categories"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_planner_categories_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#64748b")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlannerSettings(Base):
    __tablename__ = "planner_settings"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_planner_settings_user"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    work_start: Mapped[time] = mapped_column(Time, nullable=False)
    work_end: Mapped[time] = mapped_column(Time, nullable=False)
    category_targets: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    scheduler_weights: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    adaptive_scheduling: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="America/Vancouver")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PlannerRoutineBlock(Base):
    __tablename__ = "planner_routine_blocks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_categories.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    recurrence: Mapped[str] = mapped_column(String(32), nullable=False, default="weekdays")
    protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flexible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    min_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PlannerTask(Base):
    __tablename__ = "planner_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_categories.id", ondelete="RESTRICT"), index=True
    )
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    priority_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, default="manual")
    source_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    asset_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    person_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recurrence: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_started", index=True)
    delay_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PlannerScheduleBlock(Base):
    __tablename__ = "planner_schedule_blocks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    calendar_event_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_calendar_events.id", ondelete="SET NULL"), nullable=True
    )
    routine_block_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_routine_blocks.id", ondelete="SET NULL"), nullable=True
    )
    interruption_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_interruptions.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    block_type: Mapped[str] = mapped_column(String(32), nullable=False, default="task")
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_by_scheduler: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlannerTaskHistory(Base):
    __tablename__ = "planner_task_history"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="CASCADE"), index=True
    )
    previous_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    previous_start: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    new_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    new_start: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="scheduler")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlannerTimeEntry(Base):
    __tablename__ = "planner_time_entries"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    interruption_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_interruptions.id", ondelete="SET NULL"), nullable=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlannerInterruption(Base):
    __tablename__ = "planner_interruptions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_categories.id", ondelete="SET NULL"), nullable=True
    )
    related_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True
    )
    paused_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(64), nullable=False, default="emergency")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    create_work_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlannerBlocker(Base):
    __tablename__ = "planner_blockers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("planner_tasks.id", ondelete="CASCADE"), index=True
    )
    blocker_type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsible_party: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class PlannerDailyMetrics(Base):
    __tablename__ = "planner_daily_metrics"
    __table_args__ = (UniqueConstraint("company_id", "user_id", "date", name="uq_planner_daily_metrics_day"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scheduled_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delayed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    interruption_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    meeting_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    strategic_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    category_minutes: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    delay_reasons: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PlannerCalendarEvent(Base):
    """Internal/mock calendar events. Outlook/Google connectors write through the same table later."""

    __tablename__ = "planner_calendar_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="internal")
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
