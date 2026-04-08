"""Tenant-scoped floorplan blueprints (`blueprints`, `blueprint_elements`)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class Blueprint(Base):
    __tablename__ = "blueprints"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # JSON array of task overlays (id, title, mode, content, linked_element_ids)
    tasks_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    elements: Mapped[list["BlueprintElement"]] = relationship(
        back_populates="blueprint",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class BlueprintElement(Base):
    __tablename__ = "blueprint_elements"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    blueprint_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("blueprints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    element_type: Mapped[str] = mapped_column("element_type", String(16), nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rotation: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    linked_device_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    device_kind: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # Door: "{zone_element_uuid}:{edge}:{t}" edge 0–3 (top,right,bottom,left local), t ∈ [0,1] along edge
    wall_attachment: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    # JSON array of flat x,y world coords for closed `path` elements
    path_points: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    symbol_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    symbol_tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    symbol_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # JSON array of child element UUID strings for `element_type="group"`
    children_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # `element_type="connection"`: orthogonal polyline endpoints, optional metadata
    connection_from_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    connection_to_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    connection_style: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    corner_radius: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    blueprint: Mapped["Blueprint"] = relationship(back_populates="elements")
