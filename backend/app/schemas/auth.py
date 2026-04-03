from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    company_id: Optional[str] = None
    role: str
    is_impersonating: bool = False
    impersonator_sub: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class CompanySummaryOut(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    company_id: Optional[str] = None
    role: str
    full_name: Optional[str]
    enabled_features: list[str] = []
    is_impersonating: bool = False
    is_system_admin: bool = False
    company: Optional[CompanySummaryOut] = None
    onboarding_enabled: bool = True
    onboarding_completed: bool = False

    model_config = {"from_attributes": True}


class InviteAcceptBody(BaseModel):
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
