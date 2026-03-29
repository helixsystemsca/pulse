from typing import Any

from pydantic import BaseModel, Field


class RuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    event_pattern: str = Field(..., min_length=1, max_length=128)
    target_role: str = Field("admin", pattern="^(admin|worker)$")
    config: dict[str, Any] = Field(default_factory=dict)
