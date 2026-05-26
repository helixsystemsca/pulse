from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class DashboardLayoutBundleIn(BaseModel):
    """Workspace dashboard layout persisted per user + context."""

    model_config = ConfigDict(populate_by_name=True)

    version: int = Field(..., ge=1, le=999)
    layout: dict[str, Any]
    custom_widgets: dict[str, Any] = Field(default_factory=dict, alias="customWidgets")


class DashboardLayoutBundleOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    version: int
    layout: dict[str, Any]
    custom_widgets: dict[str, Any] = Field(default_factory=dict, alias="customWidgets")


class DashboardLayoutSaveOut(BaseModel):
    message: str = "Dashboard layout saved"
