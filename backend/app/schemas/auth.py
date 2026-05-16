from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.access_snapshot import AccessSnapshotOut


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    company_id: Optional[str] = None
    role: str
    roles: Optional[list[str]] = None
    is_impersonating: bool = False
    impersonator_sub: Optional[str] = None
    #: Matches ``users.token_version`` for server-side JWT invalidation.
    tv: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class MicrosoftOAuthRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=8192)


class CompanySummaryOut(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    timezone: Optional[str] = None
    industry: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    company_id: Optional[str] = None
    role: str
    roles: list[str] = []
    full_name: Optional[str]
    auth_provider: str = "email"
    avatar_url: Optional[str] = None
    avatar_status: Optional[str] = None
    job_title: Optional[str] = None
    #: Workforce / scheduling / monitoring capacity (separate from permission roles).
    operational_role: Optional[str] = None
    #: Canonical keys from department × permission matrix ∪ `feature_allow_extra` (∩ contract). Overlay assignments do not widen this list.
    enabled_features: list[str] = []
    #: Tenant contract module keys (system admin). Same list for all tenant users for module licensing checks.
    contract_features: list[str] = Field(default_factory=list)
    #: Flat RBAC permission keys for sidebar + guards (`["*"]` = unrestricted within tenant).
    rbac_permissions: list[str] = Field(default_factory=list)
    #: Full tenant contract modules (system-admin grants). Populated for company_admin for the Workers UI matrix.
    contract_enabled_features: Optional[list[str]] = None
    #: True when this user may open the Workers & Roles page (admin or delegated).
    workers_roster_access: bool = False
    is_impersonating: bool = False
    is_system_admin: bool = False
    company: Optional[CompanySummaryOut] = None
    can_use_pm_features: bool = False
    #: In-facility tenant administrator (sysadmin); base role stays in `roles` (e.g. worker).
    facility_tenant_admin: bool = False
    #: When set, prefer this label in the shell (e.g. ``Worker (Admin)``) instead of humanizing `role` alone.
    role_display_label: Optional[str] = None
    #: Effective permission strings for tenant UI (`["*"]` = full access). Omitted for system operators without a tenant session.
    permissions: Optional[list[str]] = None
    #: Deprecated: always `[]`. Department hubs use `rbac_permissions` + contract modules on the client.
    department_workspace_slugs: list[str] = Field(default_factory=list)
    #: Primary HR department slug (roster) for shell labels — not used for authorization.
    hr_department: Optional[str] = None
    #: Company-admin–granted module keys merged into RBAC resolution (subset of contract); self row only.
    feature_allow_extra: Optional[list[str]] = None
    #: Optional overlay row (`tenant_roles.id`). Does not widen `enabled_features` / sidebar modules (matrix is authoritative except `no_access`).
    tenant_role_id: Optional[str] = None
    #: Current server time (UTC ISO-8601) for client clock sync; not persisted on the user row.
    server_time: str
    #: True when the account is using the default temporary password and must set a new one.
    must_change_password: bool = False
    #: Canonical access envelope (matrix → features → capabilities). Prefer this over re-deriving on the client.
    access_snapshot: Optional[AccessSnapshotOut] = None

    model_config = {"from_attributes": True}


class InviteAcceptBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)
    password: str = Field(..., min_length=12, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class EmployeeInviteAcceptBody(BaseModel):
    """Accept an employee invite (user row already exists; set password and activate)."""

    token: str = Field(..., min_length=16, max_length=512)
    password: str = Field(..., min_length=12, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class PasswordResetConfirmBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)
    new_password: str = Field(..., min_length=12, max_length=128)


class ImpersonateRequest(BaseModel):
    target_user_id: str = Field(..., min_length=8, max_length=64)


class EffectivePermissionsOut(BaseModel):
    permissions: list[str]
