"""Persisted field inspections (Inspections & Logs → work requests)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PulseInspectionRun(Base):
    __tablename__ = "pulse_inspection_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    template_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    template_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    overall_result: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    facility_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_facilities.id", ondelete="SET NULL"), nullable=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["PulseInspectionItem"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="PulseInspectionItem.sort_order"
    )


class PulseInspectionItem(Base):
    __tablename__ = "pulse_inspection_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_inspection_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    result: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    work_request_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_work_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    run: Mapped["PulseInspectionRun"] = relationship(back_populates="items")
