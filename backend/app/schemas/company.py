from typing import Optional

from pydantic import BaseModel, Field


class CompanyProfilePatch(BaseModel):
    """Set or clear an external logo URL (https://…). Use POST /company/logo to upload a file."""

    logo_url: Optional[str] = Field(None, max_length=2048)


class CompanyLogoUploadOut(BaseModel):
    logo_url: Optional[str] = None
    message: str = "Logo updated"
