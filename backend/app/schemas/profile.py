from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.domain import OperationalRole


class CompanySettingsPatchInline(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    timezone: Optional[str] = Field(None, max_length=128)
    industry: Optional[str] = Field(None, max_length=255)


class ProfileSettingsPatch(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    job_title: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=2048)
    #: Set to null to opt out of workforce operations.
    operational_role: Optional[str] = Field(None, max_length=32)
    company: Optional[CompanySettingsPatchInline] = None

    @field_validator("operational_role")
    @classmethod
    def _op_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        s = str(v).strip()
        OperationalRole(s)
        return s


class ProfileAvatarUploadOut(BaseModel):
    avatar_url: str
    message: str = "Avatar updated"


class ProfileAvatarSignedUploadOut(BaseModel):
    bucket: str = "avatars"
    path: str
    token: str
    signed_url: str
    public_url: str


class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
