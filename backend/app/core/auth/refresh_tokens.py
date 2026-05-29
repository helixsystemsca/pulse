"""Refresh token issuance and rotation (phase 2 — behind AUTH_SESSION_MODE)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.auth_sessions import UserRefreshSession
from app.models.domain import User


def refresh_sessions_enabled(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return s.auth_session_mode.strip().lower() in ("dual", "cookie")


def _hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


async def create_refresh_session(
    db: AsyncSession,
    user: User,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
    family_id: str | None = None,
) -> tuple[str, UserRefreshSession]:
    """Return (plaintext refresh token, session row). Caller must commit."""
    settings = get_settings()
    raw = generate_refresh_token()
    fid = family_id or str(uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    row = UserRefreshSession(
        user_id=str(user.id),
        family_id=fid,
        token_hash=_hash_refresh_token(raw),
        expires_at=expires,
        user_agent=(user_agent or "")[:512] or None,
        ip_address=(ip_address or "")[:128] or None,
    )
    db.add(row)
    await db.flush()
    return raw, row


async def rotate_refresh_session(
    db: AsyncSession,
    raw_token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str] | None:
    """
    Validate refresh token, revoke it, issue a new token in the same family.

    Returns (user, new_raw_token) or None if invalid.
    """
    now = datetime.now(timezone.utc)
    th = _hash_refresh_token(raw_token.strip())
    q = await db.execute(
        select(UserRefreshSession).where(
            UserRefreshSession.token_hash == th,
            UserRefreshSession.revoked_at.is_(None),
            UserRefreshSession.expires_at > now,
        )
    )
    session = q.scalar_one_or_none()
    if not session:
        return None

    from app.models.domain import User as UserModel

    user = await db.get(UserModel, session.user_id)
    if not user or not user.is_active:
        session.revoked_at = now
        await db.flush()
        return None

    session.revoked_at = now
    new_raw, _ = await create_refresh_session(
        db,
        user,
        user_agent=user_agent,
        ip_address=ip_address,
        family_id=str(session.family_id),
    )
    return user, new_raw


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> bool:
    now = datetime.now(timezone.utc)
    th = _hash_refresh_token(raw_token.strip())
    q = await db.execute(select(UserRefreshSession).where(UserRefreshSession.token_hash == th))
    session = q.scalar_one_or_none()
    if not session:
        return False
    session.revoked_at = now
    await db.flush()
    return True


async def revoke_all_refresh_sessions_for_user(db: AsyncSession, user_id: str) -> int:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        update(UserRefreshSession)
        .where(
            UserRefreshSession.user_id == user_id,
            UserRefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    return int(res.rowcount or 0)
