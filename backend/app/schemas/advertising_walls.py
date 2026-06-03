"""Arena advertising wall plans — persisted per tenant."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AdvertisingWallPlanOut(BaseModel):
    id: str
    name: str
    width_inches: float = Field(..., ge=1)
    height_inches: float = Field(..., ge=1)
    backdropKind: str = "neutral"
    backdropUrl: Optional[str] = None
    backdropNaturalWidth: Optional[float] = None
    backdropNaturalHeight: Optional[float] = None
    gridSnapInches: Optional[float] = None
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    constraints: list[dict[str, Any]] = Field(default_factory=list)
    calibration: Optional[dict[str, Any]] = None


class AdvertisingWallsOut(BaseModel):
    walls: list[AdvertisingWallPlanOut] = Field(default_factory=list)


class AdvertisingWallsPutIn(BaseModel):
    walls: list[dict[str, Any]] = Field(default_factory=list, max_length=64)


class AdvertisingBackdropUploadOut(BaseModel):
    backdrop_url: str
    backdropNaturalWidth: Optional[float] = None
    backdropNaturalHeight: Optional[float] = None
