"""Disk storage + validation for tenant company logo file uploads (shared by tenant and system routes)."""

from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings

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


def write_company_logo_file(company_id: str, ext_with_dot: str, raw: bytes) -> None:
    root = Path(get_settings().pulse_uploads_dir) / "company_logos"
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{company_id}{ext_with_dot}"
    for old in root.glob(f"{company_id}.*"):
        if old != path:
            try:
                old.unlink()
            except OSError:
                pass
    path.write_bytes(raw)
