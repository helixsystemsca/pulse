"""High-level async helpers for tenant uploads."""

from __future__ import annotations

import asyncio
from typing import Callable, TypeVar

from app.core.storage.factory import get_storage_provider
from app.core.storage.keys import (
    company_branding_key,
    inventory_image_key,
    profile_photo_key,
)
from app.core.storage.types import StoredObject

T = TypeVar("T")


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
    provider = get_storage_provider()
    return await _run_sync(lambda: provider.read_file(str(storage_key).strip()))


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
