"""Normalized tenant RBAC (departments → roles → permission grants). Organizational only — visibility derives from grants."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class RbacCatalogPermission(Base):
    """Global flat permission keys (seeded; referenced by grants)."""

    __tablename__ = "rbac_catalog_permissions"

    key: Mapped[str] = mapped_column(String(160), primary_key=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class TenantDepartment(Base):
    """Company-scoped organizational department (not used for authorization logic in v2 path)."""

    __tablename__ = "tenant_departments"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_tenant_departments_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    roles: Mapped[list["TenantRole"]] = relationship(back_populates="department", cascade="all, delete-orphan")


class TenantRole(Base):
    """Department-scoped role template (permissions assigned via TenantRoleGrant)."""

    __tablename__ = "tenant_roles"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_tenant_roles_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tenant_departments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(96), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    department: Mapped["TenantDepartment"] = relationship(back_populates="roles")
    grants: Mapped[list["TenantRoleGrant"]] = relationship(back_populates="role", cascade="all, delete-orphan")


class TenantRoleGrant(Base):
    """Many-to-many: role ↔ catalog permission key."""

    __tablename__ = "tenant_role_grants"

    tenant_role_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tenant_roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_key: Mapped[str] = mapped_column(
        String(160), ForeignKey("rbac_catalog_permissions.key", ondelete="CASCADE"), primary_key=True
    )

    role: Mapped["TenantRole"] = relationship(back_populates="grants")


class RbacAuditEvent(Base):
    """Append-only RBAC / entitlement changes (enterprise audit trail)."""

    __tablename__ = "rbac_audit_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True
    )
    actor_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
