"""Enterprise inventory extensions (lifecycle, checkout, forecasting)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class InventoryLifecycleIn(BaseModel):
    acquired_on: Optional[date] = None
    acquisition_cost: Optional[float] = None
    useful_life_months: Optional[int] = Field(None, ge=1, le=600)
    salvage_value: Optional[float] = Field(None, ge=0)
    expected_retirement_on: Optional[date] = None
    depreciation_method: Optional[str] = None
    vendor_id: Optional[str] = None


class InventoryDisposalIn(BaseModel):
    disposed_on: date
    disposal_method: str = Field(..., min_length=1, max_length=64)
    disposal_notes: Optional[str] = None


class InventoryCheckoutIn(BaseModel):
    condition_out: Optional[str] = None
    notes: Optional[str] = None
    zone_id: Optional[str] = None
    expected_return_at: Optional[datetime] = None


class InventoryCheckinIn(BaseModel):
    condition_in: Optional[str] = None
    notes: Optional[str] = None


class InventoryReorderPolicyIn(BaseModel):
    base_low_stock_threshold: Optional[float] = Field(None, ge=0)
    consumption_lookback_days: int = Field(90, ge=7, le=365)
    seasonal_multipliers: dict[str, float] = Field(default_factory=dict)
    event_boosts: list[dict[str, Any]] = Field(default_factory=list)


class InventoryLocationBalanceIn(BaseModel):
    zone_id: str
    quantity: float = Field(..., ge=0)


class InventoryLocationBalanceOut(BaseModel):
    zone_id: str
    quantity: float


class InventoryHistoryCardOut(BaseModel):
    item: dict[str, Any]
    lifecycle: dict[str, Any]
    forecast: dict[str, Any]
    open_checkout: Optional[dict[str, Any]] = None
    movements: list[dict[str, Any]] = []
    usage: list[dict[str, Any]] = []
    checkouts: list[dict[str, Any]] = []
