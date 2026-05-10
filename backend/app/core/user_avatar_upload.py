"""User profile photo uploads (same validation as company logos)."""

from __future__ import annotations

from typing import Optional

INTERNAL_AVATAR_PATH = "/api/v1/profile/avatar"
INTERNAL_AVATAR_PENDING_PATH = "/api/v1/profile/avatar-pending"

_MAX_AVATAR_BYTES = 5 * 1024 * 1024
_AVATAR_CT_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def validate_avatar_bytes(ct: str, raw: bytes) -> str:
    """Return filename suffix (e.g. ``.webp``). Raises ``ValueError`` with a user-facing message."""
    if ct not in _AVATAR_CT_EXT:
        raise ValueError("Upload an image (JPEG, PNG, or WebP)")
    if len(raw) > _MAX_AVATAR_BYTES:
        raise ValueError("Image too large (max 5MB)")
    return _AVATAR_CT_EXT[ct]


def co_worker_avatar_url(user_id: str, stored_avatar_url: Optional[str]) -> Optional[str]:
    """
    URL safe to embed in tenant APIs so any authorized teammate can load the image.
    Replaces the owner-only /profile/avatar path with /pulse/workers/{id}/avatar for internal storage.
    """
    if not stored_avatar_url:
        return None
    s = str(stored_avatar_url).strip()
    if not s:
        return None
    low = s.lower()
    if low.startswith("http://") or low.startswith("https://"):
        return s
    return f"/api/v1/pulse/workers/{user_id}/avatar"


__all__ = [
    "INTERNAL_AVATAR_PATH",
    "INTERNAL_AVATAR_PENDING_PATH",
    "co_worker_avatar_url",
    "validate_avatar_bytes",
]
