"""Purchasing module API schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class PurchasingSettingsOut(BaseModel):
    enabled: bool = True
    enable_replenishment_requests: bool = True
    enable_quick_purchases: bool = True
    enable_receipt_uploads: bool = True
    enable_vendor_tracking: bool = True
    enable_contract_archive: bool = False
    enable_purchase_history: bool = True
    enable_monthly_expense_exports: bool = True
    require_vendor_selection: bool = False
    require_receipt_upload: bool = False
    purchasing_label: str = "Purchasing"
    replenishment_label: str = "Replenishment Queue"


class QuickPurchaseLineIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(gt=0, default=1)
    unit_cost: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=128)
    add_to_inventory: bool = False
    zone_id: Optional[str] = None
    inventory_item_id: Optional[str] = None


class QuickPurchaseCreateIn(BaseModel):
    purchase_date: date
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = Field(None, max_length=255)
    total_amount: float = Field(gt=0)
    notes: Optional[str] = Field(None, max_length=2000)
    add_to_inventory: bool = False
    lines: list[QuickPurchaseLineIn] = Field(min_length=1)

    @model_validator(mode="after")
    def _vendor_present(self) -> "QuickPurchaseCreateIn":
        if not self.vendor_id and not (self.vendor_name or "").strip():
            pass
        return self


class QuickPurchaseLineOut(BaseModel):
    id: str
    name: str
    quantity: float
    unit_cost: Optional[float] = None
    category: Optional[str] = None
    add_to_inventory: bool
    zone_id: Optional[str] = None
    inventory_item_id: Optional[str] = None


class QuickPurchaseOut(BaseModel):
    id: str
    company_id: str
    purchase_date: date
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    total_amount: float
    notes: Optional[str] = None
    add_to_inventory: bool
    has_receipt: bool
    receipt_filename: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    lines: list[QuickPurchaseLineOut]


class QuickPurchaseListOut(BaseModel):
    items: list[QuickPurchaseOut]
    total: int


class VendorPerformanceOut(BaseModel):
    vendor_id: str
    total_purchases: int
    last_purchase_date: Optional[date] = None
    average_purchase_value: Optional[float] = None


class InventoryVendorWithPerformanceOut(BaseModel):
    id: str
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    preferred_vendor: bool = False
    total_purchases: int = 0
    last_purchase_date: Optional[date] = None
    average_purchase_value: Optional[float] = None
