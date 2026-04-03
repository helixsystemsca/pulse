from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SystemCompanyCreate(BaseModel):
    """Create an empty tenant (invite company admin separately)."""

    name: str = Field(..., min_length=1, max_length=255)
    enabled_features: list[str] = Field(default_factory=list)


class SystemCompanyCreateAndInvite(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    admin_email: EmailStr
    enabled_features: list[str] = Field(default_factory=list)


class SystemCompanyBootstrapPassword(BaseModel):
    """Legacy: create company and first admin with a password (no invite)."""

    company_name: str = Field(..., min_length=1, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8, max_length=128)
    admin_full_name: Optional[str] = Field(None, max_length=255)
    enabled_features: list[str] = Field(default_factory=list)


class SystemCompanyPatch(BaseModel):
    enabled_features: Optional[list[str]] = None
    is_active: Optional[bool] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=2048)
    header_image_url: Optional[str] = Field(None, max_length=2048)


class SystemInviteCreate(BaseModel):
    email: EmailStr
    company_id: str = Field(..., min_length=8, max_length=64)
    role: str = Field(default="company_admin", pattern="^company_admin$")


class SystemOverviewOut(BaseModel):
    total_companies: int
    total_users: int
    active_companies: int
    feature_usage: dict[str, int]


class SystemCompanyRow(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    enabled_features: list[str]
    user_count: int
    is_active: bool
    owner_admin_id: Optional[str]


class SystemUserRow(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    company_id: Optional[str]
    company_name: Optional[str]
    is_active: bool
    last_login: Optional[str]


class SystemPendingInviteRow(BaseModel):
    """Unused invite — no `users` row until the recipient completes /invite flow."""

    invite_id: str
    email: str
    role: str
    company_id: str
    company_name: Optional[str]
    expires_at: str


class SystemUsersDirectoryOut(BaseModel):
    users: list[SystemUserRow]
    pending_invites: list[SystemPendingInviteRow]


class SystemLogRow(BaseModel):
    id: str
    action: str
    performed_by: Optional[str]
    target_type: Optional[str]
    target_id: Optional[str]
    metadata: dict
    logged_at: str
