"""Tenant background image uploads (org dashboard / mobile blur hero)."""

from __future__ import annotations

from pathlib import Path

from app.core.company_logo_upload import INTERNAL_LOGO_PATH, normalize_logo_content_type, validate_logo_bytes
from app.core.config import get_settings

INTERNAL_BACKGROUND_PATH = "/api/v1/company/background"


def background_disk_path(company_id: str) -> Path:
    root = Path(get_settings().pulse_uploads_dir) / "company_backgrounds"
    root.mkdir(parents=True, exist_ok=True)
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        p = root / f"{company_id}{ext}"
        if p.is_file():
            return p
    return root / f"{company_id}.png"


def write_company_background_file(company_id: str, ext_with_dot: str, raw: bytes) -> None:
    root = Path(get_settings().pulse_uploads_dir) / "company_backgrounds"
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{company_id}{ext_with_dot}"
    for old in root.glob(f"{company_id}.*"):
        if old != path:
            try:
                old.unlink()
            except OSError:
                pass
    path.write_bytes(raw)


__all__ = [
    "INTERNAL_BACKGROUND_PATH",
    "background_disk_path",
    "normalize_logo_content_type",
    "validate_logo_bytes",
    "write_company_background_file",
]

