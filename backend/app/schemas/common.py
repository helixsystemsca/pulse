import json
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class FeatureToggle(BaseModel):
    module_key: str = Field(..., min_length=2, max_length=64)
    enabled: bool


_MAX_INGEST_BODY = 48_000  # bytes of JSON — limits DoS via huge payloads


class EventIngest(BaseModel):
    """Generic passive ingestion envelope (BLE, scales, etc.)."""

    event_type: str = Field(..., min_length=1, max_length=128, pattern=r"^[\w.:\-]+$")
    payload: dict[str, Any] = Field(default_factory=dict)
    source: Optional[str] = Field(None, max_length=64, pattern=r"^[\w.\-]*$")

    @field_validator("payload", mode="after")
    @classmethod
    def payload_size_cap(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(v) > 200:
            raise ValueError("payload has too many keys")
        raw = json.dumps(v, default=str)
        if len(raw.encode("utf-8")) > _MAX_INGEST_BODY:
            raise ValueError("payload too large")
        return v
