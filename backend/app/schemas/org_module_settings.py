from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OrgModuleSettingsOut(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)


class OrgModuleSettingsPatchIn(BaseModel):
    """Deep-merge patch: top-level keys are module ids (`workRequests`, `schedule`, …)."""

    settings: dict[str, Any] = Field(default_factory=dict)
