"""User profile photo uploads (same validation as company logos)."""

from __future__ import annotations

from typing import Optional

from app.core.company_logo_upload import validate_logo_bytes

INTERNAL_AVATAR_PATH = "/api/v1/profile/avatar"
INTERNAL_AVATAR_PENDING_PATH = "/api/v1/profile/avatar-pending"


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
    "validate_logo_bytes",
]
