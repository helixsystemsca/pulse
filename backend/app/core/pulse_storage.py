"""
Durable binary uploads for Pulse: company logos/backgrounds, user avatars, equipment images.

- ``local`` (default): files under ``pulse_uploads_dir`` (same layout as before).
- ``s3``: S3-compatible API (AWS S3, Cloudflare R2, MinIO, etc.); survives stateless deploys.

Configure with ``PULSE_STORAGE_BACKEND=s3`` plus bucket/credentials; see ``.env.example``.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Callable, Literal, Optional, TypeVar

from app.core.config import get_settings

try:
    from botocore.exceptions import ClientError
except ImportError:
    ClientError = Exception  # type: ignore[misc, assignment]

logger = logging.getLogger(__name__)

_MEDIA_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

T = TypeVar("T")

_LOGO_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")
_EQUIP_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def media_type_for_ext(ext: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext.lower(), "application/octet-stream")


def _backend() -> Literal["local", "s3"]:
    s = get_settings()
    b = (s.pulse_storage_backend or "local").strip().lower()
    if b in ("s3", "object", "object_storage"):
        return "s3"
    return "local"


def _s3_key(relative_key: str) -> str:
    """``relative_key`` is e.g. ``company_logos/{id}.png`` (no leading slash)."""
    s = get_settings()
    pfx = (s.pulse_s3_key_prefix or "pulse").strip().strip("/")
    rel = relative_key.lstrip("/")
    return f"{pfx}/{rel}" if pfx else rel


def _require_s3_config() -> tuple[object, str]:
    """Return (boto3_client, bucket_name). Raises RuntimeError if misconfigured."""
    try:
        import boto3  # type: ignore[import-untyped]
    except ImportError as e:
        raise RuntimeError(
            "PULSE_STORAGE_BACKEND=s3 requires the `boto3` package. Install backend dependencies or use local storage."
        ) from e

    s = get_settings()
    bucket = (s.pulse_s3_bucket or "").strip()
    if not bucket:
        raise RuntimeError("PULSE_STORAGE_BACKEND=s3 requires PULSE_S3_BUCKET (or AWS_S3_BUCKET).")
    key = (s.pulse_s3_access_key_id or "").strip()
    secret = (s.pulse_s3_secret_access_key or "").strip()
    if not key or not secret:
        raise RuntimeError(
            "PULSE_STORAGE_BACKEND=s3 requires PULSE_S3_ACCESS_KEY_ID and PULSE_S3_SECRET_ACCESS_KEY "
            "(or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)."
        )

    endpoint = (s.pulse_s3_endpoint_url or "").strip() or None
    region = (s.pulse_s3_region or "us-east-1").strip() or "us-east-1"

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name=region,
    )
    return client, bucket


def _local_root() -> Path:
    return Path(get_settings().pulse_uploads_dir)


def _local_read_stem(subdir: str, stem: str, exts: tuple[str, ...]) -> Optional[tuple[bytes, str]]:
    base = _local_root() / subdir
    for ext in exts:
        p = base / f"{stem}{ext}"
        if p.is_file():
            return (p.read_bytes(), media_type_for_ext(ext))
    return None


def _local_write_stem(subdir: str, stem: str, ext_with_dot: str, raw: bytes) -> None:
    base = _local_root() / subdir
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"{stem}{ext_with_dot}"
    for old in base.glob(f"{stem}.*"):
        if old != path:
            try:
                old.unlink()
            except OSError:
                pass
    path.write_bytes(raw)


def _local_delete_stem(subdir: str, stem: str) -> None:
    base = _local_root() / subdir
    if not base.is_dir():
        return
    for old in base.glob(f"{stem}.*"):
        try:
            old.unlink()
        except OSError:
            pass


def _s3_read_key(client: object, bucket: str, key: str) -> Optional[bytes]:
    try:
        resp = client.get_object(Bucket=bucket, Key=key)  # type: ignore[union-attr]
        return resp["Body"].read()
    except ClientError as e:  # type: ignore[misc]
        code = e.response.get("Error", {}).get("Code", "") if hasattr(e, "response") else ""
        if code in ("404", "NoSuchKey", "NotFound", "NoSuchBucket"):
            return None
        raise


def _s3_read_stem(subdir: str, stem: str, exts: tuple[str, ...]) -> Optional[tuple[bytes, str]]:
    client, bucket = _require_s3_config()
    for ext in exts:
        key = _s3_key(f"{subdir}/{stem}{ext}")
        body = _s3_read_key(client, bucket, key)
        if body is not None:
            return (body, media_type_for_ext(ext))
    return None


def _s3_delete_stem_variants(client: object, bucket: str, subdir: str, stem: str) -> None:
    prefix = _s3_key(f"{subdir}/{stem}.")
    try:
        paginator = client.get_paginator("list_objects_v2")  # type: ignore[union-attr]
        to_delete: list[dict[str, str]] = []
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents") or []:
                k = obj.get("Key")
                if k:
                    to_delete.append({"Key": k})
        if to_delete:
            client.delete_objects(Bucket=bucket, Delete={"Objects": to_delete})  # type: ignore[union-attr]
    except Exception as e:  # noqa: BLE001
        logger.warning("S3 delete stem variants prefix=%s: %s", prefix, e)


def _s3_write_stem(subdir: str, stem: str, ext_with_dot: str, content_type: str, raw: bytes) -> None:
    client, bucket = _require_s3_config()
    _s3_delete_stem_variants(client, bucket, subdir, stem)
    key = _s3_key(f"{subdir}/{stem}{ext_with_dot}")
    extra: dict[str, object] = {}
    if content_type:
        extra["ContentType"] = content_type
    client.put_object(Bucket=bucket, Key=key, Body=raw, **extra)  # type: ignore[union-attr]


async def _run_sync(fn: Callable[[], T]) -> T:
    return await asyncio.to_thread(fn)


# --- Company logo ---


async def read_company_logo_bytes(company_id: str) -> Optional[tuple[bytes, str]]:
    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem("company_logos", company_id, _LOGO_EXTS))
    return _local_read_stem("company_logos", company_id, _LOGO_EXTS)


async def write_company_logo_bytes(
    company_id: str, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)
    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem("company_logos", company_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(lambda: _local_write_stem("company_logos", company_id, ext_with_dot, raw))


# --- Company background ---


async def read_company_background_bytes(company_id: str) -> Optional[tuple[bytes, str]]:
    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem("company_backgrounds", company_id, _LOGO_EXTS))
    return _local_read_stem("company_backgrounds", company_id, _LOGO_EXTS)


async def write_company_background_bytes(
    company_id: str, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)
    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem("company_backgrounds", company_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(lambda: _local_write_stem("company_backgrounds", company_id, ext_with_dot, raw))


# --- User avatars ---


async def read_user_avatar_bytes(user_id: str) -> Optional[tuple[bytes, str]]:
    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem("user_avatars", user_id, _LOGO_EXTS))
    return _local_read_stem("user_avatars", user_id, _LOGO_EXTS)


async def read_user_avatar_pending_bytes(user_id: str) -> Optional[tuple[bytes, str]]:
    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem("user_avatars_pending", user_id, _LOGO_EXTS))
    return _local_read_stem("user_avatars_pending", user_id, _LOGO_EXTS)


async def write_user_avatar_bytes(user_id: str, ext_with_dot: str, raw: bytes, content_type: str) -> None:
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)
    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem("user_avatars", user_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(lambda: _local_write_stem("user_avatars", user_id, ext_with_dot, raw))


async def write_user_avatar_pending_bytes(
    user_id: str, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)
    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem("user_avatars_pending", user_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(lambda: _local_write_stem("user_avatars_pending", user_id, ext_with_dot, raw))


async def delete_user_avatar_pending_files(user_id: str) -> None:
    """Remove pending avatar binaries (e.g. after reject or successful promote)."""

    def _s3() -> None:
        client, bucket = _require_s3_config()
        _s3_delete_stem_variants(client, bucket, "user_avatars_pending", user_id)

    if _backend() == "s3":
        await _run_sync(_s3)
    else:
        await _run_sync(lambda: _local_delete_stem("user_avatars_pending", user_id))


async def promote_user_avatar_pending_to_approved(user_id: str) -> bool:
    """
    Copy pending avatar file into the approved ``user_avatars`` location and clear pending.
    Returns False if there was no pending file on disk/S3.
    """
    pending = await read_user_avatar_pending_bytes(user_id)
    if not pending:
        return False
    raw, media_type = pending
    ext = _MEDIA_TO_EXT.get((media_type or "").split(";")[0].strip().lower(), ".png")
    await write_user_avatar_bytes(user_id, ext, raw, media_type)
    await delete_user_avatar_pending_files(user_id)
    return True


# --- Facility equipment + part images ---


async def read_equipment_image_bytes(company_id: str, equipment_id: str) -> Optional[tuple[bytes, str]]:
    sub = f"facility_equipment_images/{company_id}"

    def _local() -> Optional[tuple[bytes, str]]:
        return _local_read_stem(sub, equipment_id, _EQUIP_EXTS)

    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem(sub, equipment_id, _EQUIP_EXTS))
    return _local()


async def read_part_image_bytes(company_id: str, part_id: str) -> Optional[tuple[bytes, str]]:
    sub = f"equipment_part_images/{company_id}"

    def _local() -> Optional[tuple[bytes, str]]:
        return _local_read_stem(sub, part_id, _EQUIP_EXTS)

    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem(sub, part_id, _EQUIP_EXTS))
    return _local()


async def write_equipment_image_bytes(
    company_id: str, equipment_id: str, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    sub = f"facility_equipment_images/{company_id}"
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)

    def _local() -> None:
        _local_write_stem(sub, equipment_id, ext_with_dot, raw)

    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem(sub, equipment_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(_local)


async def write_part_image_bytes(
    company_id: str, part_id: str, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    sub = f"equipment_part_images/{company_id}"
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)

    def _local() -> None:
        _local_write_stem(sub, part_id, ext_with_dot, raw)

    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem(sub, part_id, ext_with_dot, ct, raw))
    else:
        await _run_sync(_local)


# --- Procedure step images (per step index, stem = procedure_id + "_" + index) ---


def _procedure_step_stem(procedure_id: str, step_index: int) -> str:
    return f"{procedure_id}_{step_index}"


async def read_procedure_step_image_bytes(
    company_id: str, procedure_id: str, step_index: int
) -> Optional[tuple[bytes, str]]:
    sub = f"procedure_step_images/{company_id}"
    stem = _procedure_step_stem(procedure_id, step_index)

    def _local() -> Optional[tuple[bytes, str]]:
        return _local_read_stem(sub, stem, _EQUIP_EXTS)

    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem(sub, stem, _EQUIP_EXTS))
    return _local()


async def write_procedure_step_image_bytes(
    company_id: str, procedure_id: str, step_index: int, ext_with_dot: str, raw: bytes, content_type: str
) -> None:
    sub = f"procedure_step_images/{company_id}"
    stem = _procedure_step_stem(procedure_id, step_index)
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)

    def _local() -> None:
        _local_write_stem(sub, stem, ext_with_dot, raw)

    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem(sub, stem, ext_with_dot, ct, raw))
    else:
        await _run_sync(_local)


# --- Procedure assignment photos (stem = assignment_id + "_" + photo_id) ---


def _procedure_assignment_photo_stem(assignment_id: str, photo_id: str) -> str:
    return f"{assignment_id}_{photo_id}"


async def read_procedure_assignment_photo_bytes(
    company_id: str, assignment_id: str, photo_id: str
) -> Optional[tuple[bytes, str]]:
    sub = f"procedure_assignment_photos/{company_id}"
    stem = _procedure_assignment_photo_stem(assignment_id, photo_id)

    def _local() -> Optional[tuple[bytes, str]]:
        return _local_read_stem(sub, stem, _EQUIP_EXTS)

    if _backend() == "s3":
        return await _run_sync(lambda: _s3_read_stem(sub, stem, _EQUIP_EXTS))
    return _local()


async def write_procedure_assignment_photo_bytes(
    company_id: str,
    assignment_id: str,
    photo_id: str,
    ext_with_dot: str,
    raw: bytes,
    content_type: str,
) -> str:
    """
    Store assignment photo bytes and return the stable storage path.

    The API returns a URL that streams bytes through the app for auth.
    """
    sub = f"procedure_assignment_photos/{company_id}"
    stem = _procedure_assignment_photo_stem(assignment_id, photo_id)
    ct = (content_type or "").split(";")[0].strip() or media_type_for_ext(ext_with_dot)

    def _local() -> None:
        _local_write_stem(sub, stem, ext_with_dot, raw)

    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem(sub, stem, ext_with_dot, ct, raw))
    else:
        await _run_sync(_local)

    return f"{sub}/{stem}{ext_with_dot}"


# --- Procedure acknowledgment audit PDFs (immutable compliance exports) ---


async def write_procedure_acknowledgment_pdf_bytes(company_id: str, snapshot_id: str, raw: bytes) -> str:
    """Persist PDF bytes; returns stable relative storage key (no bucket prefix)."""
    sub = f"procedure_acknowledgment_pdfs/{company_id}"
    stem = snapshot_id
    ct = "application/pdf"

    def _local() -> None:
        _local_write_stem(sub, stem, ".pdf", raw)

    if _backend() == "s3":
        await _run_sync(lambda: _s3_write_stem(sub, stem, ".pdf", ct, raw))
    else:
        await _run_sync(_local)
    return f"{sub}/{stem}.pdf"


async def read_procedure_acknowledgment_pdf_bytes(company_id: str, snapshot_id: str) -> Optional[bytes]:
    sub = f"procedure_acknowledgment_pdfs/{company_id}"
    stem = snapshot_id

    def _local() -> Optional[bytes]:
        p = _local_root() / sub / f"{stem}.pdf"
        return p.read_bytes() if p.is_file() else None

    if _backend() == "s3":
        client, bucket = _require_s3_config()
        key = _s3_key(f"{sub}/{stem}.pdf")

        def _read() -> Optional[bytes]:
            return _s3_read_key(client, bucket, key)

        return await _run_sync(_read)
    return await _run_sync(_local)


__all__ = [
    "delete_user_avatar_pending_files",
    "media_type_for_ext",
    "promote_user_avatar_pending_to_approved",
    "read_company_background_bytes",
    "read_company_logo_bytes",
    "read_equipment_image_bytes",
    "read_part_image_bytes",
    "read_procedure_acknowledgment_pdf_bytes",
    "read_procedure_step_image_bytes",
    "read_procedure_assignment_photo_bytes",
    "read_user_avatar_bytes",
    "read_user_avatar_pending_bytes",
    "write_company_background_bytes",
    "write_procedure_acknowledgment_pdf_bytes",
    "write_company_logo_bytes",
    "write_equipment_image_bytes",
    "write_part_image_bytes",
    "write_procedure_step_image_bytes",
    "write_procedure_assignment_photo_bytes",
    "write_user_avatar_bytes",
    "write_user_avatar_pending_bytes",
]
