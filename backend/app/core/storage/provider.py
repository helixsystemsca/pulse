"""Storage provider protocol."""

from __future__ import annotations

from typing import Protocol

from app.core.storage.types import StoredObject


class StorageProvider(Protocol):
    def upload_file(self, *, key: str, data: bytes, content_type: str) -> StoredObject:
        """Upload bytes at ``key``; returns stored metadata."""

    def delete_file(self, key: str) -> None:
        """Delete object if present (idempotent)."""

    def get_public_url(self, key: str) -> str | None:
        """Public URL when bucket/CDN is configured; else ``None`` (use app proxy routes)."""

    def file_exists(self, key: str) -> bool:
        """Whether the object exists in storage."""

    def read_file(self, key: str) -> tuple[bytes, str] | None:
        """Return ``(bytes, content_type)`` or ``None`` if missing."""
