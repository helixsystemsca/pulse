"""High-level async helpers for tenant uploads."""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, TypeVar

from app.core.storage.factory import get_storage_provider
from app.core.storage.keys import (
    company_branding_key,
    inventory_image_key,
    profile_photo_key,
)
from app.core.storage.types import StoredObject

T = TypeVar("T")

_log = logging.getLogger(__name__)

try:
    from botocore.exceptions import ClientError
except ImportError:
    ClientError = Exception  # type: ignore[misc, assignment]


async def _run_sync(fn: Callable[[], T]) -> T:
    return await asyncio.to_thread(fn)


async def upload_inventory_image(
    tenant_id: str,
    item_id: str,
    *,
    ext_with_dot: str,
    raw: bytes,
    content_type: str,
) -> StoredObject:
    key = inventory_image_key(tenant_id, item_id, ext_with_dot)
    provider = get_storage_provider()
    return await _run_sync(
        lambda: provider.upload_file(key=key, data=raw, content_type=content_type)
    )


async def read_by_storage_key(storage_key: str | None) -> tuple[bytes, str] | None:
    if not storage_key or not str(storage_key).strip():
        return None
    key = str(storage_key).strip()
    provider = get_storage_provider()
    _log.debug("storage_read start object_key=%s backend=%s", key, type(provider).__name__)
    try:
        result = await _run_sync(lambda: provider.read_file(key))
    except ClientError as exc:  # type: ignore[misc]
        code = exc.response.get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
        if code in ("404", "NoSuchKey", "NotFound"):
            _log.info("storage_read miss object_key=%s code=%s", key, code)
            return None
        _log.warning("storage_read s3_error object_key=%s code=%s", key, code)
        raise RuntimeError(f"Storage read failed ({code or 'ClientError'})") from exc
    except Exception as exc:
        _log.exception("storage_read failed object_key=%s", key)
        raise RuntimeError("Storage read failed") from exc
    if result is None:
        _log.info("storage_read miss object_key=%s", key)
    else:
        data, ct = result
        _log.info("storage_read ok object_key=%s bytes=%d content_type=%s", key, len(data), ct)
    return result


async def delete_by_storage_key(storage_key: str | None) -> None:
    if not storage_key or not str(storage_key).strip():
        return
    provider = get_storage_provider()
    await _run_sync(lambda: provider.delete_file(str(storage_key).strip()))


async def upload_company_branding(
    tenant_id: str,
    kind: str,
    *,
    ext_with_dot: str,
    raw: bytes,
    content_type: str,
) -> StoredObject:
    key = company_branding_key(tenant_id, kind, ext_with_dot)
    provider = get_storage_provider()
    return await _run_sync(
        lambda: provider.upload_file(key=key, data=raw, content_type=content_type)
    )


async def upload_profile_photo(
    tenant_id: str,
    user_id: str,
    *,
    pending: bool,
    ext_with_dot: str,
    raw: bytes,
    content_type: str,
) -> StoredObject:
    key = profile_photo_key(tenant_id, user_id, pending=pending, ext_with_dot=ext_with_dot)
    provider = get_storage_provider()
    return await _run_sync(
        lambda: provider.upload_file(key=key, data=raw, content_type=content_type)
    )


async def upload_spatial_binary(*, key: str, raw: bytes, content_type: str) -> StoredObject:
    provider = get_storage_provider()
    return await _run_sync(
        lambda: provider.upload_file(key=key, data=raw, content_type=content_type)
    )
