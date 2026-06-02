"""Inventory issue/receive transaction payloads (scanner + batch)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class InventoryTransactionReferenceIn(BaseModel):
    """Optional plug-in reference (work order, project, cost code, etc.)."""

    reference_type: Optional[str] = Field(None, max_length=64)
    reference_id: Optional[str] = Field(None, max_length=128)
    reference_note: Optional[str] = Field(None, max_length=512)


class InventoryTransactionLineIn(BaseModel):
    item_id: str
    quantity: float = Field(gt=0)
    location_id: Optional[str] = Field(None, description="Facility zone id")
    reference: Optional[InventoryTransactionReferenceIn] = None


class InventoryBatchTransactionIn(BaseModel):
    transaction_type: Literal["issue", "receive"]
    lines: list[InventoryTransactionLineIn] = Field(min_length=1)
    reference: Optional[InventoryTransactionReferenceIn] = None

    @model_validator(mode="after")
    def _validate_reference_policy(self) -> "InventoryBatchTransactionIn":
        return self


class InventoryTransactionLineOut(BaseModel):
    item_id: str
    sku: str
    name: str
    quantity: float
    transaction_type: Literal["issue", "receive"]
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    quantity_before: float
    quantity_after: float
    movement_id: str


class InventoryBatchTransactionOut(BaseModel):
    transaction_type: Literal["issue", "receive"]
    lines: list[InventoryTransactionLineOut]
    created_at: datetime


class InventoryTransactionSettingsOut(BaseModel):
    require_reference: bool = False
    enable_references: bool = False
    enable_batch_transactions: bool = True
    enable_location_selection: bool = True
