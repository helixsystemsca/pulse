from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass(frozen=True)
class SignedUploadUrl:
    bucket: str
    path: str
    token: str
    signed_url: str


def _storage_base_url() -> str:
    s = get_settings().supabase_url.strip().rstrip("/")
    return f"{s}/storage/v1"


def public_object_url(bucket: str, path: str) -> str:
    base = get_settings().supabase_url.strip().rstrip("/")
    safe = path.lstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{safe}"


async def create_signed_upload_url(bucket: str, path: str, *, expires_in: int = 600, upsert: bool = True) -> SignedUploadUrl:
    """
    Create a signed upload URL + token for a path in a bucket.

    Uses the service role key so clients do not need Supabase Auth; application auth controls who can request the URL.
    """
    settings = get_settings()
    if not settings.supabase_url.strip() or not settings.supabase_service_role_key.strip():
        raise RuntimeError("Supabase storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")

    base = _storage_base_url()
    url = f"{base}/object/upload/sign/{bucket}/{path.lstrip('/')}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    payload: dict = {"expiresIn": int(expires_in)}
    # Supabase storage-api supports upsert for signed upload URLs.
    payload["upsert"] = bool(upsert)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase storage error {resp.status_code}: {resp.text[:500]}")
        data = resp.json() if resp.content else {}

    signed_url = str(data.get("signedURL") or data.get("signedUrl") or "").strip()
    token = str(data.get("token") or "").strip()
    returned_path = str(data.get("path") or path).lstrip("/")

    if not signed_url or not token:
        raise RuntimeError("Supabase storage did not return signedURL/token")

    return SignedUploadUrl(bucket=bucket, path=returned_path, token=token, signed_url=signed_url)

