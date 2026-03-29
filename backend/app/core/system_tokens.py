"""Opaque token generation and HMAC-SHA256 storage (single-use, expiring)."""

import hashlib
import hmac
import secrets

from app.core.config import get_settings


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def hash_system_token(raw: str) -> str:
    key = get_settings().secret_key.encode("utf-8")
    return hmac.new(key, raw.encode("utf-8"), hashlib.sha256).hexdigest()
