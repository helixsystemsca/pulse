"""Storage health diagnostics."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.storage.factory import get_storage_provider, storage_backend_name
from app.core.storage.keys import health_probe_key
from app.core.storage.s3_provider import S3StorageProvider


def run_storage_health_check() -> dict[str, Any]:
    backend = storage_backend_name()
    provider = get_storage_provider()
    stages: list[dict[str, Any]] = []

    if isinstance(provider, S3StorageProvider):
        ok, detail = provider.head_bucket()
        stages.append({"name": "bucket_access", "ok": ok, "detail": detail})
        if not ok:
            return _report(backend, stages, overall_ok=False)

    probe_key = health_probe_key()
    payload = f"probe-{uuid.uuid4().hex}".encode()
    try:
        stored = provider.upload_file(key=probe_key, data=payload, content_type="text/plain")
        stages.append(
            {
                "name": "upload",
                "ok": True,
                "detail": f"Uploaded probe to {stored.object_key}",
            }
        )
    except Exception as exc:
        stages.append({"name": "upload", "ok": False, "detail": str(exc)})
        return _report(backend, stages, overall_ok=False)

    exists = provider.file_exists(probe_key)
    stages.append(
        {
            "name": "exists",
            "ok": exists,
            "detail": "Probe object visible" if exists else "Probe object not found after upload",
        }
    )

    try:
        provider.delete_file(probe_key)
        stages.append({"name": "delete", "ok": True, "detail": "Probe object deleted"})
    except Exception as exc:
        stages.append({"name": "delete", "ok": False, "detail": str(exc)})
        return _report(backend, stages, overall_ok=False)

    gone = not provider.file_exists(probe_key)
    stages.append(
        {
            "name": "delete_verify",
            "ok": gone,
            "detail": "Probe removed" if gone else "Probe still present after delete",
        }
    )

    overall = all(s["ok"] for s in stages)
    return _report(backend, stages, overall_ok=overall)


def _report(backend: str, stages: list[dict[str, Any]], *, overall_ok: bool) -> dict[str, Any]:
    return {
        "backend": backend,
        "overall_ok": overall_ok,
        "stages": stages,
    }
