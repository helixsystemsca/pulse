"""Pydantic schemas for recreation operations foundation modules."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class OpsLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_type: str
    from_id: str
    to_type: str
    to_id: str
    link_role: str
    created_at: datetime


class OpsLinkCreateIn(BaseModel):
    to_type: str = Field(..., max_length=64)
    to_id: str
    link_role: str = Field(default="related", max_length=64)


class OpsRevisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entity_type: str
    entity_id: str
    revision: int
    snapshot: dict[str, Any]
    changed_by_user_id: Optional[str] = None
    created_at: datetime


class OpsRecordBaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    title: str
    description: Optional[str] = None
    status: str
    tags: list[Any] = Field(default_factory=list)
    attachments: list[Any] = Field(default_factory=list)
    notes: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    links: list[OpsLinkOut] = Field(default_factory=list)


class OpsRecordBaseIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    status: str = Field(default="active", max_length=64)
    tags: list[Any] = Field(default_factory=list)
    attachments: list[Any] = Field(default_factory=list)
    notes: Optional[str] = None


class OpsRecordBasePatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=64)
    tags: Optional[list[Any]] = None
    attachments: Optional[list[Any]] = None
    notes: Optional[str] = None


# —— Knowledge ——
class OpsKnowledgeOut(OpsRecordBaseOut):
    category: str
    body_rich: Optional[str] = None
    revision: int = 1


class OpsKnowledgeCreateIn(OpsRecordBaseIn):
    category: str = Field(default="Facility Notes", max_length=128)
    body_rich: Optional[str] = None


class OpsKnowledgePatchIn(OpsRecordBasePatch):
    category: Optional[str] = Field(None, max_length=128)
    body_rich: Optional[str] = None


# —— Meetings ——
class OpsMeetingOut(OpsRecordBaseOut):
    meeting_date: Optional[date] = None
    participants: list[Any] = Field(default_factory=list)
    decisions: list[Any] = Field(default_factory=list)
    action_items: list[Any] = Field(default_factory=list)


class OpsMeetingCreateIn(OpsRecordBaseIn):
    meeting_date: Optional[date] = None
    participants: list[Any] = Field(default_factory=list)
    decisions: list[Any] = Field(default_factory=list)
    action_items: list[Any] = Field(default_factory=list)


class OpsMeetingPatchIn(OpsRecordBasePatch):
    meeting_date: Optional[date] = None
    participants: Optional[list[Any]] = None
    decisions: Optional[list[Any]] = None
    action_items: Optional[list[Any]] = None


# —— People ——
class OpsPersonOut(OpsRecordBaseOut):
    position: Optional[str] = None
    department: Optional[str] = None
    responsibilities: Optional[str] = None
    expertise: list[Any] = Field(default_factory=list)
    certifications: list[Any] = Field(default_factory=list)
    cross_training: list[Any] = Field(default_factory=list)
    reports_to_person_id: Optional[str] = None
    role_label: Optional[str] = None
    training: list[Any] = Field(default_factory=list)
    strengths: Optional[str] = None
    development_opportunities: Optional[str] = None
    current_priorities: Optional[str] = None
    projects_notes: Optional[str] = None
    important_relationships: Optional[str] = None
    need_from_me: Optional[str] = None
    need_from_them: Optional[str] = None
    decision_authority: Optional[str] = None
    communication_preference: Optional[str] = None
    team_name: Optional[str] = None
    sort_order: int = 0


class OpsPersonCreateIn(OpsRecordBaseIn):
    position: Optional[str] = None
    department: Optional[str] = None
    responsibilities: Optional[str] = None
    expertise: list[Any] = Field(default_factory=list)
    certifications: list[Any] = Field(default_factory=list)
    cross_training: list[Any] = Field(default_factory=list)
    reports_to_person_id: Optional[str] = None
    role_label: Optional[str] = None
    training: list[Any] = Field(default_factory=list)
    strengths: Optional[str] = None
    development_opportunities: Optional[str] = None
    current_priorities: Optional[str] = None
    projects_notes: Optional[str] = None
    important_relationships: Optional[str] = None
    need_from_me: Optional[str] = None
    need_from_them: Optional[str] = None
    decision_authority: Optional[str] = None
    communication_preference: Optional[str] = None
    team_name: Optional[str] = None
    sort_order: int = 0


class OpsPersonPatchIn(OpsRecordBasePatch):
    position: Optional[str] = None
    department: Optional[str] = None
    responsibilities: Optional[str] = None
    expertise: Optional[list[Any]] = None
    certifications: Optional[list[Any]] = None
    cross_training: Optional[list[Any]] = None
    reports_to_person_id: Optional[str] = None
    role_label: Optional[str] = None
    training: Optional[list[Any]] = None
    strengths: Optional[str] = None
    development_opportunities: Optional[str] = None
    current_priorities: Optional[str] = None
    projects_notes: Optional[str] = None
    important_relationships: Optional[str] = None
    need_from_me: Optional[str] = None
    need_from_them: Optional[str] = None
    decision_authority: Optional[str] = None
    communication_preference: Optional[str] = None
    team_name: Optional[str] = None
    sort_order: Optional[int] = None


# —— Contractors ——
class OpsContractorOut(OpsRecordBaseOut):
    company_name: Optional[str] = None
    primary_contact: Optional[str] = None
    trade: Optional[str] = None
    services_provided: Optional[str] = None
    emergency_contact: Optional[str] = None
    preferred_vendor: bool = False
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    insurance_carrier: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[date] = None
    wcb_account: Optional[str] = None
    wcb_expiry: Optional[date] = None
    hourly_rate: Optional[str] = None
    after_hours_rate: Optional[str] = None
    tickets: list[Any] = Field(default_factory=list)
    safety_docs: list[Any] = Field(default_factory=list)
    agreements: list[Any] = Field(default_factory=list)
    serviced_assets: list[Any] = Field(default_factory=list)
    serviced_facilities: list[Any] = Field(default_factory=list)
    compliance: dict[str, Any] = Field(default_factory=dict)


class OpsContractorCreateIn(OpsRecordBaseIn):
    company_name: Optional[str] = None
    primary_contact: Optional[str] = None
    trade: Optional[str] = None
    services_provided: Optional[str] = None
    emergency_contact: Optional[str] = None
    preferred_vendor: bool = False
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    insurance_carrier: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[date] = None
    wcb_account: Optional[str] = None
    wcb_expiry: Optional[date] = None
    hourly_rate: Optional[str] = None
    after_hours_rate: Optional[str] = None
    tickets: list[Any] = Field(default_factory=list)
    safety_docs: list[Any] = Field(default_factory=list)
    agreements: list[Any] = Field(default_factory=list)
    serviced_assets: list[Any] = Field(default_factory=list)
    serviced_facilities: list[Any] = Field(default_factory=list)


class OpsContractorPatchIn(OpsRecordBasePatch):
    company_name: Optional[str] = None
    primary_contact: Optional[str] = None
    trade: Optional[str] = None
    services_provided: Optional[str] = None
    emergency_contact: Optional[str] = None
    preferred_vendor: Optional[bool] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    insurance_carrier: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[date] = None
    wcb_account: Optional[str] = None
    wcb_expiry: Optional[date] = None
    hourly_rate: Optional[str] = None
    after_hours_rate: Optional[str] = None
    tickets: Optional[list[Any]] = None
    safety_docs: Optional[list[Any]] = None
    agreements: Optional[list[Any]] = None
    serviced_assets: Optional[list[Any]] = None
    serviced_facilities: Optional[list[Any]] = None


# —— Regulations ——
class OpsRegulationOut(OpsRecordBaseOut):
    authority: str = ""
    regulation_name: Optional[str] = None
    summary: Optional[str] = None
    requirements: Optional[str] = None
    inspection_frequency: Optional[str] = None
    external_references: list[Any] = Field(default_factory=list)


class OpsRegulationCreateIn(OpsRecordBaseIn):
    authority: str = Field(default="", max_length=255)
    regulation_name: Optional[str] = None
    summary: Optional[str] = None
    requirements: Optional[str] = None
    inspection_frequency: Optional[str] = None
    external_references: list[Any] = Field(default_factory=list)


class OpsRegulationPatchIn(OpsRecordBasePatch):
    authority: Optional[str] = Field(None, max_length=255)
    regulation_name: Optional[str] = None
    summary: Optional[str] = None
    requirements: Optional[str] = None
    inspection_frequency: Optional[str] = None
    external_references: Optional[list[Any]] = None


# —— Facilities ——
class OpsFacilityOut(OpsRecordBaseOut):
    building_info: Optional[str] = None
    mechanical_systems: Optional[str] = None
    emergency_procedures: Optional[str] = None
    photos: list[Any] = Field(default_factory=list)
    documents: list[Any] = Field(default_factory=list)


class OpsFacilityCreateIn(OpsRecordBaseIn):
    building_info: Optional[str] = None
    mechanical_systems: Optional[str] = None
    emergency_procedures: Optional[str] = None
    photos: list[Any] = Field(default_factory=list)
    documents: list[Any] = Field(default_factory=list)


class OpsFacilityPatchIn(OpsRecordBasePatch):
    building_info: Optional[str] = None
    mechanical_systems: Optional[str] = None
    emergency_procedures: Optional[str] = None
    photos: Optional[list[Any]] = None
    documents: Optional[list[Any]] = None


# —— Quick notes ——
class OpsQuickNoteOut(OpsRecordBaseOut):
    priority: str = "normal"
    follow_up_status: str = "open"
    images: list[Any] = Field(default_factory=list)


class OpsQuickNoteCreateIn(OpsRecordBaseIn):
    priority: str = Field(default="normal", max_length=32)
    follow_up_status: str = Field(default="open", max_length=64)
    images: list[Any] = Field(default_factory=list)


class OpsQuickNotePatchIn(OpsRecordBasePatch):
    priority: Optional[str] = Field(None, max_length=32)
    follow_up_status: Optional[str] = Field(None, max_length=64)
    images: Optional[list[Any]] = None


# —— Contacts ——
class OpsContactOut(OpsRecordBaseOut):
    contact_type: str = "other"
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role_label: Optional[str] = None


class OpsContactCreateIn(OpsRecordBaseIn):
    contact_type: str = Field(default="other", max_length=64)
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role_label: Optional[str] = None


class OpsContactPatchIn(OpsRecordBasePatch):
    contact_type: Optional[str] = Field(None, max_length=64)
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role_label: Optional[str] = None
