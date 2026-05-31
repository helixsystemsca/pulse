"""Bundled operations dashboard payload (single round trip)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.pulse import (
    AssetOut,
    BeaconEquipmentOut,
    DashboardOut,
    InventoryItemOut,
    ShiftOut,
    WorkRequestListOut,
    WorkerOut,
    ZoneOut,
)


class DashboardBootstrapOut(BaseModel):
    dashboard: DashboardOut
    work_requests: WorkRequestListOut
    workers: list[WorkerOut]
    assets: list[AssetOut]
    low_stock: list[InventoryItemOut] = Field(default_factory=list)
    schedule_facilities: list[ZoneOut] = Field(default_factory=list)
    equipment: list[BeaconEquipmentOut] = Field(default_factory=list)
    shifts: list[ShiftOut] = Field(default_factory=list)
    shifts_from: Optional[datetime] = None
    shifts_to: Optional[datetime] = None
