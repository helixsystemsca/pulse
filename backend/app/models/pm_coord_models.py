"""Internal PM coordination entities — parallel to `pulse_projects`; gated by `user.can_use_pm_features`.

Names use `pm_coord_` prefix to avoid collision with maintenance `pm_tasks` / `pm_task_parts`.
"""

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


class PmCoordTaskStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    complete = "complete"


class PmCoordRiskImpact(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PmCoordResourceKind(str, enum.Enum):
    material = "material"
    tool = "tool"
    other = "other"


class PmCoordProject(Base):
    __tablename__ = "pm_coord_projects"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deliverables: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    definition_of_done: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_update: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    post_project_review: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    readiness_tasks_defined: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    readiness_materials_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    readiness_dependencies_set: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PmCoordTask(Base):
    __tablename__ = "pm_coord_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_task_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=PmCoordTaskStatus.not_started.value)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PmCoordTaskDependency(Base):
    """Successor task_id is blocked until prerequisite depends_on_task_id is complete."""

    __tablename__ = "pm_coord_task_dependencies"
    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_pm_coord_dep_pair"),
        CheckConstraint("task_id <> depends_on_task_id", name="ck_pm_coord_dep_no_self"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    depends_on_task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )


class PmCoordRisk(Base):
    __tablename__ = "pm_coord_risks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    risk_description: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[str] = mapped_column(String(16), nullable=False, default=PmCoordRiskImpact.medium.value)
    mitigation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PmCoordTaskResource(Base):
    __tablename__ = "pm_coord_task_resources"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pm_coord_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_kind: Mapped[str] = mapped_column(String(32), nullable=False, default=PmCoordResourceKind.material.value)
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inventory_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True
    )
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
