from typing import Literal, Optional

from pydantic import BaseModel, Field


class ZoneTransitionIn(BaseModel):
    tag_id: str = Field(..., min_length=1, max_length=128)
    zone_id: Optional[str] = Field(None, max_length=64)
    transition: Literal["enter", "exit"]
    # Optional hints for inference rules (BLE / worker context); never required for ingestion.
    worker_user_id: Optional[str] = Field(None, max_length=64)
    signal_strength: Optional[float] = Field(None, ge=0, le=1)


class ToolCreate(BaseModel):
    tag_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class ProximityAssignIn(BaseModel):
    tool_tag_id: str = Field(..., min_length=1, max_length=128)
    worker_user_id: str = Field(..., min_length=1, max_length=64)


class MissingScanIn(BaseModel):
    expected_tag_ids: list[str] = Field(default_factory=list, max_length=500)
