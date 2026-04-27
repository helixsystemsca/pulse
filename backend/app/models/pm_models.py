"""Preventive maintenance tasks and work-order line items (checklist + parts)."""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class PmFrequencyType(str, enum.Enum):
    days = "days"
    weeks = "weeks"
    months = "months"


class PmTask(Base):
    __tablename__ = "pm_tasks"
    __table_args__ = (
        CheckConstraint("frequency_value > 0", name="ck_pm_tasks_frequency_value_pos"),
        CheckConstraint(
            "frequency_type IN ('days','weeks','months')",
            name="ck_pm_tasks_frequency_type",
        ),
        CheckConstraint(
            "(equipment_id IS NOT NULL AND tool_id IS NULL) OR (equipment_id IS NULL AND tool_id IS NOT NULL)",
            name="ck_pm_tasks_one_asset",
        ),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("facility_equipment.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("tools.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    frequency_type: Mapped[str] = mapped_column(String(16), nullable=False)
    frequency_value: Mapped[int] = mapped_column(Integer, nullable=False)
    last_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    estimated_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    auto_create_work_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PmTaskPart(Base):
    __tablename__ = "pm_task_parts"
    __table_args__ = (
        UniqueConstraint("pm_task_id", "part_id", name="uq_pm_task_parts_task_part"),
        CheckConstraint("quantity > 0", name="ck_pm_task_parts_qty_pos"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    pm_task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    part_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("equipment_parts.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class PmTaskChecklistItem(Base):
    __tablename__ = "pm_task_checklist_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    pm_task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PulseWorkRequestPartLine(Base):
    __tablename__ = "pulse_work_request_parts"
    __table_args__ = (
        UniqueConstraint("work_request_id", "part_id", name="uq_pulse_wr_parts_wr_part"),
        CheckConstraint("quantity > 0", name="ck_pulse_wr_parts_qty_pos"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    work_request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    part_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("equipment_parts.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class PulseWorkRequestChecklistItem(Base):
    __tablename__ = "pulse_work_request_checklist_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    work_request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_work_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
