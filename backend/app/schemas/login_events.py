"""API shapes for login activity (early-stage usage validation)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LoginEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: datetime
    ip_address: str
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    user_agent: Optional[str] = None
    login_method: str = "password"
    #: user | impersonation | internal_test
    session_origin: str = "user"
    impersonator_email: Optional[str] = None
    #: True when IP matches a recent sign-in by the viewer (likely your own testing).
    likely_your_session: bool = False


class LoginEventsQuery(BaseModel):
    end_user_only: bool = Field(
        default=False,
        description="When true, omit impersonation and internal-test tagged sessions.",
    )
