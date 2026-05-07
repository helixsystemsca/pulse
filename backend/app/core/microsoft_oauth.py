"""Supabase Microsoft OAuth verification for Phase 1 SSO authentication."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings


@dataclass(frozen=True)
class MicrosoftIdentity:
    """Normalized identity claims verified through Supabase Auth."""

    supabase_user_id: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None


class MicrosoftOAuthError(RuntimeError):
    """Raised when Supabase cannot verify a Microsoft OAuth session."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _metadata_text(metadata: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _has_microsoft_provider(user_json: dict[str, Any]) -> bool:
    app_metadata = user_json.get("app_metadata")
    if isinstance(app_metadata, dict):
        provider = app_metadata.get("provider")
        if provider in {"azure", "microsoft"}:
            return True
        providers = app_metadata.get("providers")
        if isinstance(providers, list) and any(p in {"azure", "microsoft"} for p in providers):
            return True

    identities = user_json.get("identities")
    if isinstance(identities, list):
        for identity in identities:
            if isinstance(identity, dict) and identity.get("provider") in {"azure", "microsoft"}:
                return True
    return False


def _safe_avatar_url(raw: str | None) -> str | None:
    if not raw:
        return None
    if raw.startswith("https://"):
        return raw
    return None


async def verify_supabase_microsoft_access_token(settings: Settings, access_token: str) -> MicrosoftIdentity:
    """Fetch the Supabase Auth user for ``access_token`` and require the Microsoft/Azure provider."""

    supabase_url = settings.supabase_url.rstrip("/")
    api_key = (settings.supabase_anon_key or settings.supabase_service_role_key).strip()
    if not supabase_url or not api_key:
        raise MicrosoftOAuthError("supabase_not_configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": api_key,
                },
            )
    except httpx.HTTPError as exc:
        raise MicrosoftOAuthError("supabase_unavailable") from exc

    if res.status_code == 401:
        raise MicrosoftOAuthError("invalid_supabase_session")
    if res.status_code >= 400:
        raise MicrosoftOAuthError("supabase_unavailable")

    try:
        user_json = res.json()
    except ValueError as exc:
        raise MicrosoftOAuthError("invalid_supabase_response") from exc

    if not _has_microsoft_provider(user_json):
        raise MicrosoftOAuthError("provider_not_microsoft")

    email_raw = user_json.get("email")
    if not isinstance(email_raw, str) or not email_raw.strip():
        raise MicrosoftOAuthError("missing_email")
    email = email_raw.strip().lower()

    metadata = user_json.get("user_metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    display_name = _metadata_text(metadata, "full_name", "name", "display_name", "preferred_username")
    avatar_url = _safe_avatar_url(_metadata_text(metadata, "avatar_url", "picture"))
    supabase_user_id = str(user_json.get("id") or "").strip()

    return MicrosoftIdentity(
        supabase_user_id=supabase_user_id,
        email=email,
        display_name=display_name,
        avatar_url=avatar_url,
    )
