"""Standard API envelopes for mobile / frontend clients."""

from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiSuccess(BaseModel, Generic[T]):
    success: bool = True
    data: T
    meta: Optional[dict[str, Any]] = Field(default=None)
