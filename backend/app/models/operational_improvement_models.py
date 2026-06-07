"""Operational improvements workflow models."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OperationalImprovementStatus(str, enum.Enum):
    identified = "identified"
    analyzing = "analyzing"
    planning = "planning"
    implementing = "implementing"
    measuring = "measuring"
    completed = "completed"
    awaiting_review = "awaiting_review"
    archived = "archived"


class OperationalImprovementPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class OperationalImprovementCategory(str, enum.Enum):
    inventory = "inventory"
    procurement = "procurement"
    communication = "communication"
    scheduling = "scheduling"
    maintenance = "maintenance"
    safety = "safety"
    quality = "quality"
    documentation = "documentation"
    other = "other"


class OperationalImprovementAnalysisType(str, enum.Enum):
    root_cause_5_whys = "root_cause_5_whys"
    fishbone = "fishbone"
    process_analysis = "process_analysis"
    five_s = "five_s"
    kanban = "kanban"
    kaizen = "kaizen"
    standardization = "standardization"


class OperationalImprovementActionStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    blocked = "blocked"
    cancelled = "cancelled"


class OperationalImprovement(Base):
    __tablename__ = "operational_improvements"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"))
    display_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    department_slug: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"))
    reporter_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"))
    date_identified: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    estimated_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stakeholders_affected: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="identified")
    implementation_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    measurement_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    knowledge_base_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    analyses: Mapped[list["OperationalImprovementAnalysis"]] = relationship(
        back_populates="improvement",
        cascade="all, delete-orphan",
    )
    actions: Mapped[list["OperationalImprovementAction"]] = relationship(
        back_populates="improvement",
        cascade="all, delete-orphan",
    )
    attachments: Mapped[list["OperationalImprovementAttachment"]] = relationship(
        back_populates="improvement",
        cascade="all, delete-orphan",
    )


class OperationalImprovementAnalysis(Base):
    __tablename__ = "operational_improvement_analyses"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"))
    improvement_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("operational_improvements.id", ondelete="CASCADE"),
    )
    analysis_type: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    improvement: Mapped[OperationalImprovement] = relationship(back_populates="analyses")


class OperationalImprovementAction(Base):
    __tablename__ = "operational_improvement_actions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"))
    improvement_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("operational_improvements.id", ondelete="CASCADE"),
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    owner_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"))
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_work_request_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_work_requests.id", ondelete="SET NULL"),
    )
    linked_project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    improvement: Mapped[OperationalImprovement] = relationship(back_populates="actions")


class OperationalImprovementAttachment(Base):
    __tablename__ = "operational_improvement_attachments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"))
    improvement_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("operational_improvements.id", ondelete="CASCADE"),
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachment_type: Mapped[str] = mapped_column(String(32), nullable=False, default="document")
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    improvement: Mapped[OperationalImprovement] = relationship(back_populates="attachments")
