"""Recreation operations foundation — knowledge, meetings, people, contractors, regulations, facilities, notes, contacts."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class OpsRecordBase(Base):
    """Shared columns for every recreation-ops record."""

    __abstract__ = True

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="active")
    tags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    attachments: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsKnowledgeArticle(OpsRecordBase):
    __tablename__ = "ops_knowledge_articles"

    category: Mapped[str] = mapped_column(String(128), nullable=False, default="Facility Notes")
    body_rich: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class OpsMeeting(OpsRecordBase):
    __tablename__ = "ops_meetings"

    meeting_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    participants: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    decisions: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    action_items: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)


class OpsPerson(OpsRecordBase):
    __tablename__ = "ops_people"

    position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    responsibilities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expertise: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    certifications: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    cross_training: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    # Phase 2 — Person Matrix / org chart (operational relationships, not HR)
    reports_to_person_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_people.id", ondelete="SET NULL"), nullable=True, index=True
    )
    role_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    training: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    development_opportunities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_priorities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    projects_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    important_relationships: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    need_from_me: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    need_from_them: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision_authority: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    communication_preference: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    team_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class OpsContractor(OpsRecordBase):
    __tablename__ = "ops_contractors"

    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    primary_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    trade: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    services_provided: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    preferred_vendor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    insurance_carrier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    insurance_policy: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    insurance_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    wcb_account: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    wcb_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hourly_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    after_hours_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    tickets: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    safety_docs: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    agreements: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    serviced_assets: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    serviced_facilities: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)


class OpsRegulation(OpsRecordBase):
    __tablename__ = "ops_regulations"

    authority: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    regulation_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inspection_frequency: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    external_references: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    topic_category: Mapped[str] = mapped_column(String(64), nullable=False, default="Other")
    applicability: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    classification: Mapped[str] = mapped_column(String(64), nullable=False, default="Regulator guidance")
    official_source_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    official_source_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(64), nullable=False, default="Unverified")
    review_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pulse_pointers: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    # Catalog slug (e.g. chief-engineer-plant-responsibility). Null for Josh-created cards.
    source_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    # Once true, Vernon starter seed must not overwrite this row.
    user_modified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class OpsFacility(OpsRecordBase):
    __tablename__ = "ops_facilities"

    building_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mechanical_systems: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emergency_procedures: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photos: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    documents: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)


class OpsQuickNote(OpsRecordBase):
    __tablename__ = "ops_quick_notes"

    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    follow_up_status: Mapped[str] = mapped_column(String(64), nullable=False, default="open")
    images: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)


class OpsContact(OpsRecordBase):
    __tablename__ = "ops_contacts"

    contact_type: Mapped[str] = mapped_column(String(64), nullable=False, default="other")
    organization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class OpsEntityLink(Base):
    """Bidirectional relationship between any two ops entities (and future external ids)."""

    __tablename__ = "ops_entity_links"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "from_type",
            "from_id",
            "to_type",
            "to_id",
            "link_role",
            name="uq_ops_entity_links",
        ),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    from_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    from_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    to_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    to_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    link_role: Mapped[str] = mapped_column(String(64), nullable=False, default="related")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class OpsRevision(Base):
    """Revision history snapshots (primarily knowledge articles; reusable for any entity)."""

    __tablename__ = "ops_revisions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    changed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
