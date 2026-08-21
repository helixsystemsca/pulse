"""Phase 1 personal command center — profile, role, checklists, knowledge gaps."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class OpsPersonalProfile(Base):
    """Per-user professional operating profile (philosophy, principles, role purpose)."""

    __tablename__ = "ops_personal_profiles"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_ops_personal_profiles_user"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    manager_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    contact_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    certifications: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    qualifications: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    # Philosophy sections: leadership, safety, maintenance, asset_management, customer_service, continuous_improvement, decision_making
    philosophy: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Editable list of operating principles (strings)
    principles: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    role_purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_ops_person_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_people.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsRoleResponsibility(Base):
    __tablename__ = "ops_role_responsibilities"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="Operations")
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    frequency: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsAuthorityMatrixRow(Base):
    __tablename__ = "ops_authority_matrix_rows"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    decision: Mapped[str] = mapped_column(String(512), nullable=False)
    # Levels: staff / coordinator / manager / director — freeform JSON map of role → bool or note
    levels: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsChecklistTemplate(Base):
    __tablename__ = "ops_checklist_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # null company_id = system seed template available to all tenants
    slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="onboarding")
    # sections: [{ id, title, items: [{ id, title, description? }] }]
    structure: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsChecklistInstance(Base):
    __tablename__ = "ops_checklist_instances"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    template_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_checklist_templates.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="personal")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["OpsChecklistItem"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan", order_by="OpsChecklistItem.sort_order"
    )


class OpsChecklistItem(Base):
    __tablename__ = "ops_checklist_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    instance_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_checklist_instances.id", ondelete="CASCADE"), index=True
    )
    section: Mapped[str] = mapped_column(String(128), nullable=False, default="General")
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    instance: Mapped["OpsChecklistInstance"] = relationship(back_populates="items")


class OpsKnowledgeGap(Base):
    __tablename__ = "ops_knowledge_gaps"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False, default="General")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    who_should_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    date_confirmed: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    related_policy: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    related_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    related_procedure: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


# —— Phase 2 Organization: skills, development plans, team risks ——


class OpsSkill(Base):
    __tablename__ = "ops_skills"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_ops_skills_company_name"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False, default="General")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsSkillRating(Base):
    __tablename__ = "ops_skill_ratings"
    __table_args__ = (UniqueConstraint("company_id", "skill_id", "person_id", name="uq_ops_skill_ratings_person"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    skill_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_skills.id", ondelete="CASCADE"), index=True
    )
    person_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_people.id", ondelete="CASCADE"), index=True
    )
    # beginner | developing | competent | advanced | expert
    proficiency: Mapped[str] = mapped_column(String(32), nullable=False, default="beginner")
    certification: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_demonstrated: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    training_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cross_training_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsDevelopmentPlan(Base):
    __tablename__ = "ops_development_plans"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    person_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_people.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="Development plan")
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    development_goals: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    training: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mentoring: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cross_training: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    progress: Mapped[str] = mapped_column(String(32), nullable=False, default="not_started")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OpsTeamRisk(Base):
    __tablename__ = "ops_team_risks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    # single_point_of_failure | skill_shortage | certification_gap | succession_gap | institutional_knowledge
    risk_type: Mapped[str] = mapped_column(String(64), nullable=False, default="skill_shortage")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    related_person_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_people.id", ondelete="SET NULL"), nullable=True
    )
    related_skill: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    mitigation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
