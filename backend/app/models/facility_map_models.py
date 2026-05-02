"""Facility maps — tenant-scoped drawings (`facility_maps`).

Each map is one facility image plus overlay elements (zones, annotations) stored as JSON.
Infrastructure graph rows (`infra_assets`, `infra_connections`) optionally scope to `map_id`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class FacilityMap(Base):
    __tablename__ = "facility_maps"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False, default="General")
    image_url: Mapped[str] = mapped_column(Text, nullable=False, default="")

    elements_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tasks_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    layers_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
