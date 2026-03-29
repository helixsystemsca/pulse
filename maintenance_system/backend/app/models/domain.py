"""Domain models — all tenant-scoped entities carry company_id for platform integration."""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional
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
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class UserRole(str, enum.Enum):
    system_admin = "system_admin"
    company_admin = "company_admin"
    manager = "manager"
    worker = "worker"


class RequestStatus(str, enum.Enum):
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    converted = "converted"


class WorkOrderStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    on_hold = "on_hold"
    completed = "completed"
    closed = "closed"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class PMFrequency(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    custom = "custom"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_user_company_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
        default=UserRole.worker,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company: Mapped[Company] = relationship()
    assets: Mapped[list["Asset"]] = relationship(back_populates="created_by_user", foreign_keys="Asset.created_by_user_id")


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("company_id", "external_id", name="uq_asset_company_external"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(128), default="equipment")
    location: Mapped[str] = mapped_column(String(512), default="")
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company: Mapped[Company] = relationship()
    created_by_user: Mapped[Optional[User]] = relationship(
        back_populates="assets", foreign_keys=[created_by_user_id]
    )


class WorkRequest(Base):
    __tablename__ = "work_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=Priority.medium,
    )
    location: Mapped[str] = mapped_column(String(512), default="")
    asset_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("assets.id"), nullable=True)
    requested_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=RequestStatus.submitted,
    )
    rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class WorkOrder(Base):
    __tablename__ = "work_orders"
    __table_args__ = (UniqueConstraint("company_id", "work_order_number", name="uq_wo_company_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    work_order_number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[WorkOrderStatus] = mapped_column(
        Enum(WorkOrderStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=24),
        default=WorkOrderStatus.open,
    )
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        default=Priority.medium,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str] = mapped_column(String(512), default="")
    asset_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("assets.id"), nullable=True)
    assigned_to_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    source_request_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("work_requests.id"), nullable=True)
    source_pm_schedule_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("pm_schedules.id"), nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    company: Mapped[Company] = relationship()
    notes: Mapped[list["WorkOrderNote"]] = relationship(back_populates="work_order", order_by="WorkOrderNote.created_at")
    attachments: Mapped[list["WorkOrderAttachment"]] = relationship(
        back_populates="work_order", order_by="WorkOrderAttachment.created_at"
    )


class WorkOrderNote(Base):
    __tablename__ = "work_order_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    work_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("work_orders.id"), nullable=False, index=True)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    work_order: Mapped[WorkOrder] = relationship(back_populates="notes")


class WorkOrderAttachment(Base):
    __tablename__ = "work_order_attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    work_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("work_orders.id"), nullable=False, index=True)
    uploaded_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    # Placeholder: store metadata until blob storage is wired
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    storage_uri: Mapped[str] = mapped_column(String(1024), default="placeholder://local")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    work_order: Mapped[WorkOrder] = relationship(back_populates="attachments")


class PMSchedule(Base):
    __tablename__ = "pm_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(36), ForeignKey("assets.id"), nullable=False)
    frequency: Mapped[PMFrequency] = mapped_column(
        Enum(PMFrequency, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        nullable=False,
    )
    interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    assigned_to_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company: Mapped[Company] = relationship()
    completions: Mapped[list["PMCompletion"]] = relationship(back_populates="pm_schedule", order_by="PMCompletion.completed_at")


class PMCompletion(Base):
    __tablename__ = "pm_completions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    pm_schedule_id: Mapped[str] = mapped_column(String(36), ForeignKey("pm_schedules.id"), nullable=False, index=True)
    work_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("work_orders.id"), nullable=True)
    completed_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    notes: Mapped[str] = mapped_column(Text, default="")

    pm_schedule: Mapped[PMSchedule] = relationship(back_populates="completions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    actor_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(32), default="log")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )