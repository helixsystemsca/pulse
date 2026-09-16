"""Schemas for hire-time onboarding document packets."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class HireTemplateItemIn(BaseModel):
    id: Optional[str] = None
    key: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    kind: str = "review"
    body_text: Optional[str] = Field(None, max_length=8000)
    applies_when: str = "always"
    is_required: bool = True


class HireTemplateItemOut(BaseModel):
    id: str
    key: str
    title: str
    description: Optional[str] = None
    kind: str
    body_text: Optional[str] = None
    applies_when: str
    is_required: bool


class HireTemplateOut(BaseModel):
    id: str
    company_id: str
    name: str
    items: list[HireTemplateItemOut]
    updated_at: datetime


class HireTemplatePutIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    items: list[HireTemplateItemIn]


class HirePacketProgressOut(BaseModel):
    required_total: int
    required_completed: int
    percent: int
    status: str


class HirePacketItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sort_order: int
    item_key: str
    title: str
    description: Optional[str] = None
    kind: str
    body_text: Optional[str] = None
    is_required: bool
    status: str
    completed_at: Optional[datetime] = None
    completed_by_user_id: Optional[str] = None
    signature_name: Optional[str] = None
    signed_ack: bool = False


class HirePacketOut(BaseModel):
    id: str
    user_id: str
    full_name: Optional[str] = None
    email: str
    status: str
    progress: HirePacketProgressOut
    items: list[HirePacketItemOut]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class HirePacketListOut(BaseModel):
    items: list[HirePacketOut]


class HireIncompleteHireOut(BaseModel):
    packet_id: str
    user_id: str
    full_name: Optional[str] = None
    email: str
    required_total: int
    required_completed: int
    percent: int
    incomplete_titles: list[str]


class HireIncompleteSummaryOut(BaseModel):
    open_hires: int
    incomplete_required_items: int
    hires: list[HireIncompleteHireOut]


class HireCompleteItemIn(BaseModel):
    signature_name: Optional[str] = Field(None, max_length=255)
    signed_ack: bool = False


class HireOnboardingAttachOut(BaseModel):
    """Lightweight attach result returned from worker create."""

    packet_id: str
    required_total: int
    required_completed: int
    percent: int
    status: str
