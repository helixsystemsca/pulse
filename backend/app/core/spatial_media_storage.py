"""Object storage for facility map base images and advertising wall backdrops."""

from __future__ import annotations

import base64
import re
from typing import Optional

from app.core.storage.keys import advertising_wall_backdrop_key, facility_map_image_key
from app.core.storage.service import read_by_storage_key, upload_spatial_binary

_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")

_DATA_URL_RE = re.compile(r"^data:([^;,]+)?;base64,(.+)$", re.DOTALL)


def decode_data_url(data_url: str) -> tuple[bytes, str, str]:
    """Return (raw bytes, content_type, extension with dot)."""
    m = _DATA_URL_RE.match(data_url.strip())
    if not m:
        raise ValueError("Invalid data URL")
    content_type = (m.group(1) or "image/png").split(";")[0].strip().lower()
    raw = base64.b64decode(m.group(2))
    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type, ".png")
    return raw, content_type, ext


def facility_map_image_proxy_path(map_id: str) -> str:
    return f"/api/maps/{map_id}/image"


def advertising_backdrop_proxy_path(wall_id: str) -> str:
    return f"/api/advertising/walls/{wall_id}/backdrop"


async def persist_facility_map_image_url(company_id: str, map_id: str, raw_url: str) -> str:
    """Upload data URLs to object storage; return stable proxy path or passthrough URL."""
    url = (raw_url or "").strip()
    if not url:
        return ""
    proxy = facility_map_image_proxy_path(map_id)
    if url == proxy or url.endswith(f"/maps/{map_id}/image"):
        return proxy
    if url.startswith("data:"):
        raw, content_type, ext = decode_data_url(url)
        await upload_spatial_binary(
            facility_map_image_key(company_id, map_id, ext),
            raw=raw,
            content_type=content_type,
        )
        return proxy
    return url


async def read_facility_map_image(company_id: str, map_id: str) -> Optional[tuple[bytes, str]]:
    for ext in _IMAGE_EXTS:
        blob = await read_by_storage_key(facility_map_image_key(company_id, map_id, ext))
        if blob:
            return blob
    return None


async def upload_advertising_wall_backdrop(
    company_id: str,
    wall_id: str,
    *,
    raw: bytes,
    content_type: str,
    ext_with_dot: str,
) -> str:
    await upload_spatial_binary(
        advertising_wall_backdrop_key(company_id, wall_id, ext_with_dot),
        raw=raw,
        content_type=content_type,
    )
    return advertising_backdrop_proxy_path(wall_id)


async def read_advertising_wall_backdrop(company_id: str, wall_id: str) -> Optional[tuple[bytes, str]]:
    for ext in _IMAGE_EXTS:
        blob = await read_by_storage_key(advertising_wall_backdrop_key(company_id, wall_id, ext))
        if blob:
            return blob
    return None
