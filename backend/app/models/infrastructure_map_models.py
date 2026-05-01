"""Graph-based infrastructure map entities (tenant-scoped).

These tables back the multi-system overlays (fiber/irrigation/electrical/telemetry) used by the
Drawings → infrastructure map module. They are intentionally generic: systems and attributes are
data-driven (no per-system schema branching).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class InfraAsset(Base):
    __tablename__ = "infra_assets"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    asset_type: Mapped[str] = mapped_column(String(64), nullable=False, default="asset")
    system_type: Mapped[str] = mapped_column(String(32), nullable=False, default="telemetry", index=True)
    x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class InfraConnection(Base):
    __tablename__ = "infra_connections"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    from_asset_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("infra_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    to_asset_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("infra_assets.id", ondelete="CASCADE"), nullable=False, index=True)

    system_type: Mapped[str] = mapped_column(String(32), nullable=False, default="telemetry", index=True)
    connection_type: Mapped[str] = mapped_column(String(32), nullable=False, default="link")

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class InfraAttribute(Base):
    __tablename__ = "infra_attributes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)  # "asset" | "connection"
    entity_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)

    # Store as string; client interprets via JSON or type hints if needed.
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

