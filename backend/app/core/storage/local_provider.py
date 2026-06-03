"""Filesystem storage under ``pulse_uploads_dir``."""

from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import get_settings
from app.core.storage.types import StoredObject

_log = logging.getLogger(__name__)


class LocalStorageProvider:
    def __init__(self, root: Path | None = None) -> None:
        self._root = root or Path(get_settings().pulse_uploads_dir)

    def _path(self, key: str) -> Path:
        return self._root / key.replace("\\", "/").lstrip("/")

    def upload_file(self, *, key: str, data: bytes, content_type: str) -> StoredObject:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        public_url = f"/uploads/{key}"
        _log.info(
            "Uploaded file to storage",
            extra={
                "backend": "local",
                "object_key": key,
                "bytes": len(data),
                "content_type": content_type,
            },
        )
        return StoredObject(object_key=key, public_url=public_url, content_type=content_type)

    def delete_file(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()
            _log.info("Deleted file from storage", extra={"backend": "local", "object_key": key})

    def get_public_url(self, key: str) -> str | None:
        path = self._path(key)
        if path.is_file():
            return f"/uploads/{key}"
        return None

    def file_exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def read_file(self, key: str) -> tuple[bytes, str] | None:
        path = self._path(key)
        if not path.is_file():
            return None
        ct = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".pdf": "application/pdf",
        }.get(path.suffix.lower(), "application/octet-stream")
        return path.read_bytes(), ct
