"""Disk storage + validation for tenant company logo file uploads (shared by tenant and system routes)."""

from __future__ import annotations

INTERNAL_LOGO_PATH = "/api/v1/company/logo"
_MAX_BYTES = 2 * 1024 * 1024
_CT_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def normalize_logo_content_type(content_type: str | None) -> str:
    return (content_type or "").split(";")[0].strip().lower()


def validate_logo_bytes(ct: str, raw: bytes) -> str:
    """Return filename suffix (e.g. `.png`). Raises ValueError with user-facing message."""
    if ct not in _CT_EXT:
        raise ValueError("Upload an image (JPEG, PNG, WebP, or GIF)")
    if len(raw) > _MAX_BYTES:
        raise ValueError("Image too large (max 2MB)")
    return _CT_EXT[ct]
