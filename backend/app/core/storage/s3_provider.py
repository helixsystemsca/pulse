"""S3-compatible storage (AWS S3, Cloudflare R2, MinIO)."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

from app.core.config import Settings, get_settings
from app.core.storage.types import StoredObject

_log = logging.getLogger(__name__)

try:
    from botocore.exceptions import ClientError
except ImportError:
    ClientError = Exception  # type: ignore[misc, assignment]


class S3StorageProvider:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client: Any | None = None
        self._bucket = (self._settings.pulse_s3_bucket or "").strip()

    def _require_client(self) -> tuple[Any, str]:
        if self._client is not None and self._bucket:
            return self._client, self._bucket
        try:
            import boto3  # type: ignore[import-untyped]
        except ImportError as e:
            raise RuntimeError(
                "PULSE_STORAGE_BACKEND=s3 requires the `boto3` package. Install backend dependencies or use local storage."
            ) from e

        bucket = (self._settings.pulse_s3_bucket or "").strip()
        if not bucket:
            raise RuntimeError("PULSE_STORAGE_BACKEND=s3 requires S3_BUCKET (or PULSE_S3_BUCKET).")

        key_id = (self._settings.pulse_s3_access_key_id or "").strip()
        secret = (self._settings.pulse_s3_secret_access_key or "").strip()
        if not key_id or not secret:
            raise RuntimeError(
                "PULSE_STORAGE_BACKEND=s3 requires S3_ACCESS_KEY and S3_SECRET_KEY "
                "(or PULSE_S3_ACCESS_KEY_ID / PULSE_S3_SECRET_ACCESS_KEY)."
            )

        endpoint = (self._settings.pulse_s3_endpoint_url or "").strip() or None
        region = (self._settings.pulse_s3_region or "auto").strip() or "auto"

        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret,
            region_name=region,
        )
        self._bucket = bucket
        return self._client, bucket

    def _full_key(self, key: str) -> str:
        pfx = (self._settings.pulse_s3_key_prefix or "").strip().strip("/")
        rel = key.lstrip("/")
        if pfx:
            return f"{pfx}/{rel}"
        return rel

    def get_public_url(self, key: str) -> str | None:
        base = (self._settings.pulse_s3_public_base_url or "").strip().rstrip("/")
        if not base:
            return None
        full = self._full_key(key)
        return f"{base}/{quote(full, safe='/')}"

    def upload_file(self, *, key: str, data: bytes, content_type: str) -> StoredObject:
        client, bucket = self._require_client()
        full_key = self._full_key(key)
        extra: dict[str, object] = {}
        if content_type:
            extra["ContentType"] = content_type
        try:
            client.put_object(Bucket=bucket, Key=full_key, Body=data, **extra)
        except Exception as exc:
            _log.exception(
                "Storage upload failed",
                extra={"backend": "s3", "object_key": full_key, "bucket": bucket},
            )
            raise RuntimeError(f"Storage upload failed: {exc.__class__.__name__}") from exc

        public_url = self.get_public_url(key)
        _log.info(
            "Uploaded file to storage",
            extra={
                "backend": "s3",
                "object_key": full_key,
                "bucket": bucket,
                "bytes": len(data),
                "content_type": content_type,
                "has_public_url": bool(public_url),
            },
        )
        return StoredObject(object_key=key, public_url=public_url, content_type=content_type)

    def delete_file(self, key: str) -> None:
        client, bucket = self._require_client()
        full_key = self._full_key(key)
        try:
            client.delete_object(Bucket=bucket, Key=full_key)
            _log.info(
                "Deleted file from storage",
                extra={"backend": "s3", "object_key": full_key, "bucket": bucket},
            )
        except ClientError as exc:  # type: ignore[misc]
            code = exc.response.get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
            if code not in ("404", "NoSuchKey", "NotFound"):
                raise

    def file_exists(self, key: str) -> bool:
        client, bucket = self._require_client()
        full_key = self._full_key(key)
        try:
            client.head_object(Bucket=bucket, Key=full_key)
            return True
        except ClientError as exc:  # type: ignore[misc]
            code = exc.response.get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
            if code in ("404", "NoSuchKey", "NotFound", "NoSuchBucket"):
                return False
            raise

    def read_file(self, key: str) -> tuple[bytes, str] | None:
        client, bucket = self._require_client()
        full_key = self._full_key(key)
        endpoint = (self._settings.pulse_s3_endpoint_url or "").strip() or "(aws-default)"
        _log.debug(
            "S3 get_object bucket=%s object_key=%s logical_key=%s endpoint=%s",
            bucket,
            full_key,
            key,
            endpoint[:80],
        )
        try:
            resp = client.get_object(Bucket=bucket, Key=full_key)
            body = resp["Body"].read()
            ct = resp.get("ContentType") or "application/octet-stream"
            return body, str(ct)
        except ClientError as exc:  # type: ignore[misc]
            code = exc.response.get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
            if code in ("404", "NoSuchKey", "NotFound"):
                _log.info("S3 get_object miss bucket=%s key=%s code=%s", bucket, full_key, code)
                return None
            _log.warning(
                "S3 get_object error bucket=%s key=%s code=%s",
                bucket,
                full_key,
                code,
            )
            raise

    def head_bucket(self) -> tuple[bool, str]:
        """Verify bucket access."""
        try:
            client, bucket = self._require_client()
            client.head_bucket(Bucket=bucket)
            return True, f"Bucket {bucket!r} is reachable"
        except Exception as exc:
            return False, f"Bucket access failed: {exc}"
