"""HTTP schemas for project summary APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ProjectSummarySaveDraftIn(BaseModel):
    """Optional user-provided fields merged into ``user_inputs_json`` on save."""

    user_inputs: dict[str, Any] = Field(default_factory=dict)


class ProjectSummaryFinalizeIn(BaseModel):
    """User inputs persisted when marking the current draft finalized."""

    user_inputs: dict[str, Any] = Field(default_factory=dict)


class ProjectSummaryStorageStateOut(BaseModel):
    """Whether a persisted project summary draft and/or finalized row exists."""

    has_draft: bool
    has_finalized: bool


class ProjectSummaryStoredOut(BaseModel):
    """Stored summary row returned after save / finalize."""

    id: str
    project_id: str
    status: Literal["draft", "finalized"]
    snapshot_json: dict[str, Any]
    metrics_json: dict[str, Any]
    user_inputs_json: dict[str, Any]
    created_at: datetime
    finalized_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
