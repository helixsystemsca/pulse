"""Tenant-scoped object key builders (no leading slash)."""

from __future__ import annotations


def tenant_prefix(tenant_id: str) -> str:
    return f"tenant-{tenant_id}"


def inventory_image_key(tenant_id: str, item_id: str, ext_with_dot: str) -> str:
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    return f"{tenant_prefix(tenant_id)}/inventory/{item_id}{ext}"


def company_branding_key(tenant_id: str, kind: str, ext_with_dot: str) -> str:
    """kind: ``logo`` | ``background``."""
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    return f"{tenant_prefix(tenant_id)}/company-branding/{kind}{ext}"


def profile_photo_key(tenant_id: str, user_id: str, *, pending: bool, ext_with_dot: str) -> str:
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    name = f"{user_id}-pending{ext}" if pending else f"{user_id}{ext}"
    return f"{tenant_prefix(tenant_id)}/profile-photos/{name}"


def attachment_key(tenant_id: str, attachment_id: str, ext_with_dot: str) -> str:
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    return f"{tenant_prefix(tenant_id)}/attachments/{attachment_id}{ext}"


def facility_map_image_key(tenant_id: str, map_id: str, ext_with_dot: str) -> str:
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    return f"{tenant_prefix(tenant_id)}/facility-maps/{map_id}{ext}"


def advertising_wall_backdrop_key(tenant_id: str, wall_id: str, ext_with_dot: str) -> str:
    ext = ext_with_dot if ext_with_dot.startswith(".") else f".{ext_with_dot}"
    return f"{tenant_prefix(tenant_id)}/advertising/walls/{wall_id}{ext}"


def health_probe_key() -> str:
    return "__healthcheck__/probe.txt"
