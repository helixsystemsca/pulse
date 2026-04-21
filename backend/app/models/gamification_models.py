"""Gamified task + XP system tables."""

from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_to: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), index=True)

    source_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True, index=True)

    equipment_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )

    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'todo'"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class UserStats(Base):
    __tablename__ = "user_stats"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True)

    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    xp_worker: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    xp_lead: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    xp_supervisor: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    level: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    tasks_completed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    on_time_rate: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("1"))
    avg_completion_time: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0"))
    streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_streak_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    avatar_border: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unlocked_avatar_borders: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True)

    task_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_time: Mapped[float] = mapped_column(Float, nullable=False)
    was_late: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), index=True)


class XpLedger(Base):
    """Append-only idempotent XP awards (dedupe_key prevents double-crediting)."""

    __tablename__ = "xp_ledger"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_xp_ledger_user_dedupe"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(512), nullable=False)
    xp_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), index=True)


class BadgeDefinition(Base):
    __tablename__ = "badge_definitions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_key: Mapped[str] = mapped_column(String(64), nullable=False, server_default=text("'badge'"))
    category: Mapped[str] = mapped_column(String(64), nullable=False)


class UserBadge(Base):
    __tablename__ = "user_badges"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    badge_id: Mapped[str] = mapped_column(String(64), ForeignKey("badge_definitions.id", ondelete="CASCADE"), primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True)

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), index=True)

