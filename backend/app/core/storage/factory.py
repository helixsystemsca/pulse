"""Select storage backend from settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from app.core.config import get_settings
from app.core.storage.local_provider import LocalStorageProvider
from app.core.storage.provider import StorageProvider
from app.core.storage.s3_provider import S3StorageProvider


def storage_backend_name() -> Literal["local", "s3"]:
    raw = (get_settings().pulse_storage_backend or "local").strip().lower()
    if raw in ("s3", "object", "object_storage"):
        return "s3"
    return "local"


@lru_cache(maxsize=1)
def get_storage_provider() -> StorageProvider:
    if storage_backend_name() == "s3":
        return S3StorageProvider()
    return LocalStorageProvider()


def clear_storage_provider_cache() -> None:
    get_storage_provider.cache_clear()
