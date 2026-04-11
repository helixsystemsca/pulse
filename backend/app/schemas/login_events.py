"""API shapes for login activity (early-stage usage validation)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LoginEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: datetime
    ip_address: str
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    user_agent: Optional[str] = None
