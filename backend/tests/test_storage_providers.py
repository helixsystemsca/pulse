"""Storage provider unit tests (local backend)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.storage.factory import clear_storage_provider_cache, get_storage_provider
from app.core.storage.health import run_storage_health_check
from app.core.storage.keys import (
    company_branding_key,
    inventory_image_key,
    profile_photo_key,
    tenant_prefix,
)


@pytest.fixture(autouse=True)
def _local_storage_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PULSE_STORAGE_BACKEND", "local")
    monkeypatch.setenv("PULSE_UPLOADS_DIR", str(tmp_path / "uploads"))
    clear_storage_provider_cache()


def test_tenant_key_layout() -> None:
    tid = "123"
    assert tenant_prefix(tid) == "tenant-123"
    assert inventory_image_key(tid, "item-uuid", ".jpg") == "tenant-123/inventory/item-uuid.jpg"
    assert company_branding_key(tid, "logo", ".png") == "tenant-123/company-branding/logo.png"
    assert company_branding_key(tid, "background", ".webp") == "tenant-123/company-branding/background.webp"
    assert profile_photo_key(tid, "user-1", pending=False, ext_with_dot=".jpg") == (
        "tenant-123/profile-photos/user-1.jpg"
    )
    assert profile_photo_key(tid, "user-1", pending=True, ext_with_dot=".jpg") == (
        "tenant-123/profile-photos/user-1-pending.jpg"
    )


def test_local_provider_upload_read_delete() -> None:
    provider = get_storage_provider()
    key = "tenant-abc/inventory/test.jpg"
    data = b"\xff\xd8\xfftest"
    stored = provider.upload_file(key=key, data=data, content_type="image/jpeg")
    assert stored.object_key == key
    assert stored.public_url == f"/uploads/{key}"
    assert provider.file_exists(key)
    assert provider.get_public_url(key) == f"/uploads/{key}"
    blob = provider.read_file(key)
    assert blob is not None
    body, ct = blob
    assert body == data
    assert ct == "image/jpeg"
    provider.delete_file(key)
    assert not provider.file_exists(key)


def test_storage_health_check_local() -> None:
    report = run_storage_health_check()
    assert report["backend"] == "local"
    assert report["overall_ok"] is True
    assert all(stage["ok"] for stage in report["stages"])
