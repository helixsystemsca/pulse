"""User profile photo uploads (same validation as company logos)."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.core.config import get_settings
from app.core.company_logo_upload import validate_logo_bytes

INTERNAL_AVATAR_PATH = "/api/v1/profile/avatar"


def user_avatar_disk_path(user_id: str) -> Path:
    """On-disk path for the user's uploaded profile image, if present."""
    root = Path(get_settings().pulse_uploads_dir) / "user_avatars"
    root.mkdir(parents=True, exist_ok=True)
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        p = root / f"{user_id}{ext}"
        if p.is_file():
            return p
    return root / f"{user_id}.png"


def user_avatar_media_type(path: Path) -> str:
    suf = path.suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suf, "application/octet-stream")


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


def write_user_avatar_file(user_id: str, ext_with_dot: str, raw: bytes) -> None:
    root = Path(get_settings().pulse_uploads_dir) / "user_avatars"
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{user_id}{ext_with_dot}"
    for old in root.glob(f"{user_id}.*"):
        if old != path:
            try:
                old.unlink()
            except OSError:
                pass
    path.write_bytes(raw)


__all__ = [
    "INTERNAL_AVATAR_PATH",
    "co_worker_avatar_url",
    "user_avatar_disk_path",
    "user_avatar_media_type",
    "validate_logo_bytes",
    "write_user_avatar_file",
]
