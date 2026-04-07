"""User profile photo uploads (same validation as company logos)."""

from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.core.company_logo_upload import validate_logo_bytes

INTERNAL_AVATAR_PATH = "/api/v1/profile/avatar"


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


__all__ = ["INTERNAL_AVATAR_PATH", "validate_logo_bytes", "write_user_avatar_file"]
