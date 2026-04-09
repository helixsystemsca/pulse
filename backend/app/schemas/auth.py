from typing import Optional

from pydantic import BaseModel, EmailStr, Field


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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


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
    avatar_url: Optional[str] = None
    avatar_status: Optional[str] = None
    job_title: Optional[str] = None
    #: Workforce / scheduling / monitoring capacity (separate from permission roles).
    operational_role: Optional[str] = None
    enabled_features: list[str] = []
    #: Full tenant contract modules (system-admin grants). Populated for company_admin for the Workers UI matrix.
    contract_enabled_features: Optional[list[str]] = None
    #: True when this user may open the Workers & Roles page (admin or delegated).
    workers_roster_access: bool = False
    is_impersonating: bool = False
    is_system_admin: bool = False
    company: Optional[CompanySummaryOut] = None
    onboarding_enabled: bool = True
    onboarding_completed: bool = False
    #: True after user dismisses the first-login intro (or skipped); not the same as checklist completion.
    onboarding_seen: bool = True
    #: Non-admin modal tour complete or skipped (distinct from org admin checklist).
    user_onboarding_tour_completed: bool = False
    #: Effective permission strings for tenant UI (`["*"]` = full access). Omitted for system operators without a tenant session.
    permissions: Optional[list[str]] = None
    #: Current server time (UTC ISO-8601) for client clock sync; not persisted on the user row.
    server_time: str

    model_config = {"from_attributes": True}


class InviteAcceptBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class EmployeeInviteAcceptBody(BaseModel):
    """Accept an employee invite (user row already exists; set password and activate)."""

    token: str = Field(..., min_length=16, max_length=512)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class PasswordResetConfirmBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)
    new_password: str = Field(..., min_length=8, max_length=128)


class ImpersonateRequest(BaseModel):
    target_user_id: str = Field(..., min_length=8, max_length=64)


class EffectivePermissionsOut(BaseModel):
    permissions: list[str]
