"""Core domain entities: companies, users, RBAC, tools, jobs, etc."""

import enum
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


class UserRole(str, enum.Enum):
    system_admin = "system_admin"
    company_admin = "company_admin"
    manager = "manager"
    supervisor = "supervisor"
    lead = "lead"
    worker = "worker"
    demo_viewer = "demo_viewer"


class OperationalRole(str, enum.Enum):
    """Field / monitoring capacity — separate from permission `roles` (e.g. company_admin)."""

    worker = "worker"
    manager = "manager"
    supervisor = "supervisor"


class UserAccountStatus(str, enum.Enum):
    """Tenant user lifecycle (system_admin has no company)."""

    active = "active"
    invited = "invited"


class RolePermissionTarget(str, enum.Enum):
    """Which role template this row configures (company_admin sets these)."""

    manager = "manager"
    worker = "worker"


class AvatarStatus(str, enum.Enum):
    approved = "approved"
    pending = "pending"
    rejected = "rejected"


class FacilityEquipmentStatus(str, enum.Enum):
    """Facility equipment registry (distinct from tracked tools / BLE tags)."""

    active = "active"
    maintenance = "maintenance"
    offline = "offline"


class ToolStatus(str, enum.Enum):
    available = "available"
    assigned = "assigned"
    missing = "missing"
    maintenance = "maintenance"


class JobStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ComplianceRecordStatus(str, enum.Enum):
    """Stored lifecycle state; overdue is derived from pending + required_at."""

    pending = "pending"
    completed = "completed"


class ComplianceCategory(str, enum.Enum):
    procedures = "procedures"
    inspections = "inspections"
    training = "training"
    competency = "competency"


class Company(Base):
    """Tenant / company — canonical owner pointer (`owner_admin_id`); IT-style admins use `company_admin` role."""

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: App chrome wordmark (e.g. tenant acronym); null → platform default on the client.
    header_wordmark: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    logo_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    header_image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    background_image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    background_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    theme: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    timezone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    #: Plaintext default sign-in password for roster-only employees (company admin sets on branding).
    default_roster_password: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    owner_admin_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: Tenant auth policy: auth_mode, mfa_required, mfa_provider, password_login_allowed, etc.
    security_policy: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    #: Tenant-wide alert routing, e.g. inventory low-stock email recipients (company admin UI).
    operational_notifications: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="company",
        foreign_keys="User.company_id",
    )
    features: Mapped[list["CompanyFeature"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
    )


class CompanyFeature(Base):
    """Per-tenant feature toggle (one row per feature name)."""

    __tablename__ = "company_features"
    __table_args__ = (UniqueConstraint("company_id", "feature_name", name="uq_company_features_company_feature"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="features")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="email",
        server_default=text("'email'"),
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    avatar_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    avatar_pending_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    avatar_pending_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    avatar_status: Mapped[AvatarStatus] = mapped_column(
        Enum(AvatarStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        nullable=False,
        server_default=text("'approved'"),
    )
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    operational_role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    roles: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)),
        nullable=False,
        server_default=text("ARRAY['worker']::varchar(32)[]"),
    )
    account_status: Mapped[UserAccountStatus] = mapped_column(
        Enum(UserAccountStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        nullable=False,
        default=UserAccountStatus.active,
    )
    invite_token_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True, index=True)
    invite_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # User-level gating for advanced project management features (PM features).
    can_use_pm_features: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=text("false"))
    #: In-facility tenant administrator (sysadmin-granted). Keeps base role (worker/lead/…) for org chart / UI; full
    #: tenant admin powers come from permission resolution (supersedes manager-applied denies). Distinct from
    #: `company_admin` in `roles` (IT / off-site tenant owner style).
    facility_tenant_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=text("false")
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Updated on successful password login (and optional future activity hooks).
    last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Incremented when passwords change to invalidate outstanding JWTs (`tv` claim must match).
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    #: Count toward account lockout after repeated bad password attempts (email login only).
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    #: When set and in the future, password login is rejected until the window passes.
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    #: MFA enrollment timestamp (Entra Conditional Access or future TOTP).
    mfa_enrolled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_method: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    #: Stable IdP subject (Microsoft oid) when using SSO.
    sso_subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Manager-applied denial overlay for workers (subtracts from role template allows).
    permission_deny: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    #: Additive product-module keys (subset of tenant contract) granted by company admin for one-off access.
    feature_allow_extra: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    #: Additive flat RBAC keys (e.g. work_requests.edit, procedures.edit) beyond matrix/feature bridge.
    rbac_permission_extra: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    #: Per-user UI state (dashboard layouts, etc.) — synced across devices for the same account.
    ui_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    #: Optional access overlay assignment (organizational label; does not widen product modules versus the matrix).
    tenant_role_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("tenant_roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    company: Mapped[Optional[Company]] = relationship(
        back_populates="users",
        foreign_keys=[company_id],
    )
    login_events: Mapped[list["LoginEvent"]] = relationship(
        back_populates="user",
        foreign_keys="LoginEvent.user_id",
        cascade="all, delete-orphan",
    )


class LoginEvent(Base):
    """Successful password-login audit row (IP, coarse geo, user agent)."""

    __tablename__ = "login_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    ip_address: Mapped[str] = mapped_column(String(128), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    login_method: Mapped[str] = mapped_column(String(32), nullable=False, default="password")
    session_origin: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    impersonator_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user: Mapped["User"] = relationship(
        back_populates="login_events",
        foreign_keys=[user_id],
    )
    impersonator: Mapped[Optional["User"]] = relationship(
        foreign_keys=[impersonator_user_id],
    )


class RolePermission(Base):
    """Base permission grants for manager/worker roles inside a company."""

    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("company_id", "role", name="uq_role_permissions_company_role"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[RolePermissionTarget] = mapped_column(
        Enum(RolePermissionTarget, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
    )
    permissions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AuditLog(Base):
    """Append-only audit trail — never delete rows from application code."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    actor_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    company_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    polygon: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class FacilityEquipment(Base):
    """Tenant-scoped facility equipment records (HVAC, pumps, fixed assets, etc.)."""

    __tablename__ = "facility_equipment"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(128), nullable=False, default="General")
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[FacilityEquipmentStatus] = mapped_column(
        Enum(FacilityEquipmentStatus, native_enum=False, length=32),
        nullable=False,
        default=FacilityEquipmentStatus.active,
        index=True,
    )
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    installation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_service_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_service_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    service_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)


class EquipmentPart(Base):
    """Consumable / replaceable components tied to facility equipment (tenant-scoped)."""

    __tablename__ = "equipment_parts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    equipment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    replacement_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_replaced_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_replacement_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Tool(Base):
    __tablename__ = "tools"
    __table_args__ = (UniqueConstraint("company_id", "tag_id", name="uq_tool_company_tag"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag_id: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[ToolStatus] = mapped_column(Enum(ToolStatus), default=ToolStatus.available)


class DomainEventRow(Base):
    __tablename__ = "domain_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    source_module: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class InventoryScope(Base):
    """Tenant-owned inventory partition (department pool, shared pool, warehouse, …)."""

    __tablename__ = "inventory_scopes"
    __table_args__ = (UniqueConstraint("company_id", "slug", name="uq_inventory_scope_company_slug"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class DepartmentInventoryScope(Base):
    """Maps HR/workspace department slugs to inventory scopes (many-to-many via rows)."""

    __tablename__ = "department_inventory_scopes"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "department_slug",
            "scope_id",
            name="uq_department_inventory_scope_row",
        ),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    scope_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("inventory_scopes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("inventory_scopes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(32), default="count")
    low_stock_threshold: Mapped[float] = mapped_column(Float, default=0)
    #: Optional par level; when set, suggested reorder uses (maximum_qty - quantity).
    maximum_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False, default="part")
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    inv_status: Mapped[str] = mapped_column(String(32), nullable=False, default="in_stock", index=True)
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    linked_tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    item_condition: Mapped[str] = mapped_column(String(32), nullable=False, default="good")
    #: Workspace department (maintenance, communications, …) for filtering and reporting.
    department_slug: Mapped[str] = mapped_column(String(64), nullable=False, default="maintenance")
    reorder_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vendor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    acquired_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    acquisition_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    useful_life_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salvage_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expected_retirement_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disposed_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disposal_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    disposal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    #: straight_line | none
    depreciation_method: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    image_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    custom_attributes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    last_movement_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class MaterialRequestQueue(Base):
    """Low-stock items awaiting review for material request drafts."""

    __tablename__ = "material_request_queue"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    minimum_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    maximum_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reorder_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    days_until_stockout: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    urgency_tier: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    anomaly_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    estimated_unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vendor_part_number: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    reimbursable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    #: pending | drafted | submitted | ordered | received | exported
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    exported_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    export_batch_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("material_request_exports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MaterialRequestExport(Base):
    """Audit log for template-based material request Excel exports."""

    __tablename__ = "material_request_exports"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    project: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(512), nullable=False)
    cost_object: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)


class MaterialRequestDraft(Base):
    __tablename__ = "material_request_drafts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    draft_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    #: draft | submitted | closed
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MaterialRequestDraftItem(Base):
    __tablename__ = "material_request_draft_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    draft_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("material_request_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    queue_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("material_request_queue.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    vendor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    qty_requested: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class PurchasingQuickPurchase(Base):
    """Field / card purchase recorded outside formal replenishment."""

    __tablename__ = "purchasing_quick_purchases"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    receipt_filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    receipt_content_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    add_to_inventory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    lines: Mapped[list["PurchasingQuickPurchaseLine"]] = relationship(
        back_populates="purchase", cascade="all, delete-orphan"
    )


class PurchasingQuickPurchaseLine(Base):
    __tablename__ = "purchasing_quick_purchase_lines"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    purchase_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("purchasing_quick_purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    inventory_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    add_to_inventory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchase: Mapped["PurchasingQuickPurchase"] = relationship(back_populates="lines")


class InventoryMovement(Base):
    """Assignment, moves, usage, returns for advanced inventory tracking."""

    __tablename__ = "inventory_movements"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    performed_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    work_request_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_work_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class InventoryUsage(Base):
    """Parts/consumables consumed against a work request."""

    __tablename__ = "inventory_usage"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    work_request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_work_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class InventoryModuleSettings(Base):
    __tablename__ = "inventory_module_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class InventoryVendor(Base):
    """Supplier / vendor directory scoped to a company (inventory module)."""

    __tablename__ = "inventory_vendors"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    account_number: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    item_specialty: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    preferred_vendor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lead_time_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    department_slug: Mapped[str] = mapped_column(String(64), nullable=False, default="maintenance", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class InventoryCheckout(Base):
    """Check-out / check-in audit for shared tools and equipment."""

    __tablename__ = "inventory_checkouts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    checked_out_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True
    )
    checked_out_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    expected_return_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    checked_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    condition_out: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    condition_in: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    movement_out_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_movements.id", ondelete="SET NULL"), nullable=True
    )
    movement_in_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_movements.id", ondelete="SET NULL"), nullable=True
    )
    photo_out_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    photo_in_storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)


class InventoryReorderPolicy(Base):
    """Contextual reorder rules per SKU (seasonal / event boosts)."""

    __tablename__ = "inventory_reorder_policies"
    __table_args__ = (UniqueConstraint("item_id", name="uq_inventory_reorder_policies_item"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_low_stock_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    consumption_lookback_days: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    seasonal_multipliers: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    event_boosts: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class InventoryLocationBalance(Base):
    """Per-zone stock counts (stock rooms, cages, vehicles)."""

    __tablename__ = "inventory_location_balances"
    __table_args__ = (UniqueConstraint("item_id", "zone_id", name="uq_inventory_location_balance"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zone_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class InventoryContractor(Base):
    """Contractor directory scoped to a company (inventory module). Same fields as vendors."""

    __tablename__ = "inventory_contractors"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    account_number: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    item_specialty: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    department_slug: Mapped[str] = mapped_column(String(64), nullable=False, default="maintenance", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.draft)
    worker_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class JobToolLink(Base):
    __tablename__ = "job_tools"

    job_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    tool_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True
    )


class JobInventoryLink(Base):
    __tablename__ = "job_inventory"

    job_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_items.id", ondelete="CASCADE"), primary_key=True
    )
    quantity_allocated: Mapped[float] = mapped_column(Float, default=0)


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    usage_units_threshold: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    next_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schedule_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("maintenance_schedules.id", ondelete="SET NULL")
    )
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    confirmed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    inference_triggered: Mapped[bool] = mapped_column(Boolean, default=False)


class TenantNotificationRule(Base):
    """Legacy tenant-scoped event routing rules (admin UI under /notifications/rules)."""

    __tablename__ = "tenant_notification_rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_pattern: Mapped[str] = mapped_column(String(128), nullable=False)
    target_role: Mapped[str] = mapped_column(String(32), default="company_admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class ComplianceRule(Base):
    """Which SOP acknowledgment is required for a tool, and within how many hours."""

    __tablename__ = "compliance_rules"
    __table_args__ = (UniqueConstraint("company_id", "tool_id", name="uq_compliance_rules_company_tool"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    required_sop_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    sop_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    time_limit_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ComplianceRecord(Base):
    """Per-user SOP / tool acknowledgment tracking for compliance analytics."""

    __tablename__ = "compliance_records"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sop_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    sop_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category: Mapped[ComplianceCategory] = mapped_column(
        Enum(ComplianceCategory, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
        default=ComplianceCategory.procedures,
    )
    status: Mapped[ComplianceRecordStatus] = mapped_column(
        Enum(ComplianceRecordStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
        default=ComplianceRecordStatus.pending,
    )
    ignored: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    required_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class SystemSecureTokenKind(str, enum.Enum):
    password_reset = "password_reset"


class SystemLog(Base):
    """Internal system-admin audit trail — normalized target pointer."""

    __tablename__ = "system_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    performed_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    target_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    logged_at: Mapped[datetime] = mapped_column(
        "logged_at",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class Invite(Base):
    """Single-use invite token (hashed); company-scoped admin invite."""

    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class SystemSecureToken(Base):
    """Password-reset tokens only (invites use `Invite`)."""

    __tablename__ = "system_secure_tokens"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    kind: Mapped[SystemSecureTokenKind] = mapped_column(
        Enum(SystemSecureTokenKind, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    company_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
