from typing import Optional

from pydantic import BaseModel, Field


class CompanyProfilePatch(BaseModel):
    """Set or clear an external logo URL (https://…). Use POST /company/logo to upload a file."""

    logo_url: Optional[str] = Field(None, max_length=2048)
    header_image_url: Optional[str] = Field(None, max_length=2048)
    background_image_url: Optional[str] = Field(None, max_length=2048)
    name: Optional[str] = Field(None, max_length=255)
    header_wordmark: Optional[str] = Field(None, max_length=64)
    timezone: Optional[str] = Field(None, max_length=128)
    industry: Optional[str] = Field(None, max_length=255)
    default_roster_password: Optional[str] = Field(None, max_length=128)


class CompanyBrandingOut(BaseModel):
    """Company branding fields (company admin)."""

    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    header_wordmark: Optional[str] = None
    default_roster_password: Optional[str] = None


class CompanyLogoUploadOut(BaseModel):
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    header_wordmark: Optional[str] = None
    default_roster_password: Optional[str] = None
    message: str = "Logo updated"
