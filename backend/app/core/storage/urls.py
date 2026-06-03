"""Resolve stored URLs for API responses (legacy + object storage)."""

from __future__ import annotations


def is_legacy_upload_path(url: str | None) -> bool:
    if not url:
        return False
    s = str(url).strip()
    return s.startswith("/uploads/") or s.startswith("uploads/")


def is_external_http_url(url: str | None) -> bool:
    if not url:
        return False
    low = str(url).strip().lower()
    return low.startswith("http://") or low.startswith("https://")


def display_url(
    *,
    public_url: str | None,
    storage_key: str | None,
    internal_proxy_path: str | None,
) -> str | None:
    """
    Prefer explicit public URL, then internal authenticated proxy path.
    Legacy ``/uploads/...`` paths pass through unchanged.
    """
    if public_url and str(public_url).strip():
        return str(public_url).strip()
    if storage_key and internal_proxy_path:
        return internal_proxy_path
    return internal_proxy_path
