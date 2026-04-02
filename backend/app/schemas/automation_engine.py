"""Request/response schemas for automation event ingestion."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class AutomationEventIn(BaseModel):
    """Inbound gateway/mobile payload; additional keys are preserved in stored JSONB."""

    model_config = ConfigDict(extra="allow")

    event_type: str = Field(..., min_length=1, max_length=128)
    company_id: Optional[str] = Field(
        None,
        max_length=64,
        description="Required for system_admin JWTs; otherwise taken from the authenticated user",
    )


class AutomationEventAccepted(BaseModel):
    id: str
    ok: bool = True
    deduplicated: bool = False
    rate_limited: bool = False
