from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class OrganizationOut(BaseModel):
    id: str
    name: str
    header_wordmark: Optional[str] = None
    logo_url: Optional[str] = None
    background_image_url: Optional[str] = None
    theme: dict[str, Any] = Field(default_factory=dict)

