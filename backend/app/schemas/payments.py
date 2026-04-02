"""Pydantic schemas for `/api/payments` (mock billing — no payment processor)."""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

PaymentMethodType = Literal["card", "bank"]


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    type: str
    brand: Optional[str] = None
    bank_name: Optional[str] = None
    last4: str
    expiry_month: Optional[int] = None
    expiry_year: Optional[int] = None
    rail: Optional[str] = None
    holder_name: Optional[str] = None
    is_primary: bool
    created_at: datetime


class PaymentMethodCreateCard(BaseModel):
    card_number: str = Field(..., min_length=4, description="Mock PAN — only last4 is stored")
    expiry: str = Field(..., description="MM/YY")
    holder_name: str = Field(..., min_length=1, max_length=255)
    is_primary: bool = False


class PaymentMethodCreateBank(BaseModel):
    bank_name: str = Field(..., min_length=1, max_length=255)
    account_last4: str = Field(..., min_length=1, max_length=4)
    rail: Literal["ach", "wire_swift"]
    is_primary: bool = False

    @field_validator("account_last4")
    @classmethod
    def digits_only(cls, v: str) -> str:
        d = "".join(c for c in v if c.isdigit())
        if len(d) < 1:
            raise ValueError("account_last4 must contain digits")
        return d[-4:].zfill(4)[-4:]


class PaymentMethodCreate(BaseModel):
    """Union-style body: set `type` and the matching nested fields."""

    type: PaymentMethodType
    card: Optional[PaymentMethodCreateCard] = None
    bank: Optional[PaymentMethodCreateBank] = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    amount: Decimal
    currency: str
    status: str
    issued_at: datetime
    paid_at: Optional[datetime] = None
    reference_number: str


class PaymentSummaryOut(BaseModel):
    next_billing_date: Optional[datetime] = None
    billing_cycle: str = "Monthly"
    region_label: str = "North America"
    encryption_note: str = "Industrial grade protection applies to stored billing metadata (mock environment)."


class InvoiceListOut(BaseModel):
    items: list[InvoiceOut]
    total: int
