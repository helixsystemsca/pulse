"""Pulse product domain: CMMS work requests, scheduling, worker profiles, beacons."""

import enum
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class PulseWorkRequestStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    complete = "complete"
    cancelled = "cancelled"


class PulseWorkRequest(Base):
    __tablename__ = "pulse_work_requests"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[PulseWorkRequestStatus] = mapped_column(
        Enum(PulseWorkRequestStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        default=PulseWorkRequestStatus.open,
        nullable=False,
        index=True,
    )
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseWorkerProfile(Base):
    """Certifications, notes, and weekly availability windows for scheduling hints."""

    __tablename__ = "pulse_worker_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_pulse_worker_profiles_user"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certifications: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    availability: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PulseScheduleShift(Base):
    __tablename__ = "pulse_schedule_shifts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(64), default="shift", nullable=False)
    requires_supervisor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_ticketed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PulseBeaconEquipment(Base):
    __tablename__ = "pulse_beacon_equipment"
    __table_args__ = (UniqueConstraint("company_id", "beacon_id", name="uq_pulse_beacon_company_beacon"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    beacon_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    location_label: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    photo_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
