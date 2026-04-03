"""API models for tenant automation feature config (no user-defined rules)."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class FeatureConfigsOut(BaseModel):
    """Effective merged settings per feature name."""

    features: dict[str, dict[str, Any]] = Field(
        ...,
        description="Map of feature_name → merged config (includes `enabled` and feature-specific keys).",
    )


class FeatureConfigPatchIn(BaseModel):
    enabled: Optional[bool] = None
    config: Optional[dict[str, Any]] = Field(
        None,
        description="Partial JSON merged into stored `config` for this feature.",
    )
