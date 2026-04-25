"""
backend/app/models/pulse_config.py
════════════════════════════════════════════════════════════════════════════════
SQLAlchemy model for the pulse_config table.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _uuid() -> str:
    return str(uuid4())


class PulseConfig(Base):
    """
    Centralized config store. One row per (company, module, scope, key).

    Resolution order — highest wins:
        zone override  →  company setting  →  platform default (in ConfigService)
    """

    __tablename__ = "pulse_config"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "module", "scope_type", "scope_id", "key",
            name="uq_pulse_config_company_module_scope_key",
        ),
    )

    id:          Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id:  Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    module:      Mapped[str] = mapped_column(String(64),  nullable=False)
    scope_type:  Mapped[str] = mapped_column(String(16),  nullable=False, server_default="company")
    scope_id:    Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True, index=True)
    key:         Mapped[str] = mapped_column(String(128), nullable=False)
    value:       Mapped[Any] = mapped_column(JSONB,       nullable=False)
    updated_by:  Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    updated_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )
