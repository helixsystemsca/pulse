"""Persisted project summary snapshots (JSON payloads keyed by Pulse project)."""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class ProjectSummaryStatus(str, enum.Enum):
    draft = "draft"
    finalized = "finalized"


class ProjectSummary(Base):
    """Stored summary snapshot for a ``pulse_projects`` row."""

    __tablename__ = "pulse_project_summaries"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("pulse_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    metrics_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    user_inputs_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[ProjectSummaryStatus] = mapped_column(
        Enum(
            ProjectSummaryStatus,
            values_callable=lambda x: [e.value for e in x],
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=ProjectSummaryStatus.draft,
        server_default=text("'draft'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
