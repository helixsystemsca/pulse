from typing import Any, Optional

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
    operational_notifications: Optional[dict[str, Any]] = None
    inventory_low_stock: Optional["InventoryLowStockNotificationPatch"] = None


class InventoryLowStockNotificationPatch(BaseModel):
    enabled: Optional[bool] = None
    emails: Optional[str] = Field(None, max_length=4096)


class InventoryLowStockNotificationOut(BaseModel):
    enabled: bool = False
    emails: str = ""
    email_list: list[str] = Field(default_factory=list)


class InventoryLowStockTestEmailIn(BaseModel):
    """Optional recipients for test send (uses saved company settings when omitted)."""

    emails: str | None = Field(
        default=None,
        max_length=4096,
        description="Comma-separated recipient list from the form (need not be saved yet).",
    )


class CompanyBrandingOut(BaseModel):
    """Company branding fields (company admin)."""

    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    header_wordmark: Optional[str] = None
    default_roster_password: Optional[str] = None
    inventory_low_stock: InventoryLowStockNotificationOut = Field(
        default_factory=InventoryLowStockNotificationOut
    )


class CompanyLogoUploadOut(BaseModel):
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    header_wordmark: Optional[str] = None
    default_roster_password: Optional[str] = None
    message: str = "Logo updated"


CompanyProfilePatch.model_rebuild()
