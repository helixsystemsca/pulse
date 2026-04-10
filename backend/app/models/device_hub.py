"""ESP32 gateways and BLE tags (worker / equipment) for automation ingest."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class AutomationGateway(Base):
    __tablename__ = "automation_gateways"
    __table_args__ = (UniqueConstraint("company_id", "identifier", name="uq_automation_gateway_company_identifier"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    identifier: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default="offline", index=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    #: False until an operator assigns the gateway to a zone (plug-and-play pool).
    assigned: Mapped[bool] = mapped_column(Boolean, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: Bcrypt hash of a one-time device ingest secret; ESP32 uses gateway UUID + secret on POST /api/v1/device/events.
    ingest_secret_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    @property
    def ingest_enabled(self) -> bool:
        return bool(self.ingest_secret_hash)


class AutomationBleDevice(Base):
    __tablename__ = "automation_ble_devices"
    __table_args__ = (UniqueConstraint("company_id", "mac_address", name="uq_automation_ble_company_mac"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mac_address: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    assigned_worker_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AutomationUnknownDevice(Base):
    """Observed BLE MACs that are not registered as `AutomationBleDevice` (ingest telemetry only)."""

    __tablename__ = "automation_unknown_devices"
    __table_args__ = (UniqueConstraint("company_id", "mac_address", name="uq_automation_unknown_company_mac"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mac_address: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    seen_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

