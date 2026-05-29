"""Structured security audit helpers (tenant denials, cron, auth)."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit.service import record_audit

_log = logging.getLogger("pulse.security.audit")

_EMAIL_RE = re.compile(r"[^@]+@[^@]+\.[^@]+")
_BEARER_RE = re.compile(r"Bearer\s+\S+", re.I)
_SECRET_KEYS = frozenset(
    {
        "password",
        "token",
        "secret",
        "authorization",
        "ingest_secret",
        "api_key",
        "refresh_token",
        "access_token",
    }
)


def redact_security_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    out: dict[str, Any] = {}
    for key, val in metadata.items():
        lk = key.lower()
        if any(s in lk for s in _SECRET_KEYS):
            out[key] = "[redacted]"
            continue
        if isinstance(val, str):
            s = _EMAIL_RE.sub("[email]", val)
            s = _BEARER_RE.sub("Bearer [redacted]", s)
            out[key] = s
        else:
            out[key] = val
    return out


async def record_security_event(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> None:
    meta = redact_security_metadata(metadata or {})
    if request_id:
        meta["request_id"] = request_id
    await record_audit(
        db,
        action=action,
        actor_user_id=actor_user_id,
        company_id=company_id,
        metadata=meta,
    )


def record_security_event_sync(
    *,
    action: str,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Best-effort structured log when no DB session is available (e.g. cron deny before DB)."""
    meta = redact_security_metadata(metadata or {})
    _log.warning("security_event action=%s %s", action, meta)
