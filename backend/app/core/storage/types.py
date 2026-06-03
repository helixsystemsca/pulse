"""Shared types for object storage."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    """Result of a successful upload."""

    object_key: str
    public_url: str | None
    content_type: str | None = None
