"""JWT creation/validation and password hashing."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


def verify_password(plain: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except (ValueError, AttributeError):
        return False


def hash_password(plain: str) -> str:
    # bcrypt truncates at 72 bytes; bcrypt 5.x errors if callers pass longer—match that behavior explicitly.
    p = plain.encode("utf-8")
    if len(p) > 72:
        p = p[:72]
    return bcrypt.hashpw(p, bcrypt.gensalt(rounds=12)).decode("utf-8")


def bump_access_token_version(user: object) -> None:
    """Invalidate outstanding JWTs after a password change (must match ``tv`` claim)."""
    cur = int(getattr(user, "token_version", 0) or 0)
    setattr(user, "token_version", cur + 1)


def create_access_token(subject: str, extra_claims: Optional[dict[str, Any]] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm],
        options={"require_exp": True, "require_sub": True},
    )
