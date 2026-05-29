"""Shared authentication for internal cron / worker endpoints."""

from __future__ import annotations

import hmac
import logging
import time
from typing import Optional

from fastapi import HTTPException, status

from app.core.audit.security_events import record_security_event_sync

_log = logging.getLogger("pulse.security.internal")


def verify_internal_cron_secret(
    *,
    configured_secret: str,
    provided_secret: Optional[str],
    header_name: str,
    cron_timestamp: Optional[str] = None,
    max_skew_seconds: int = 300,
    allow_replay_window: bool = True,
) -> None:
    """
    Constant-time comparison of cron shared secrets.

    Optional ``X-Cron-Timestamp`` (unix seconds) rejects replayed requests outside ``max_skew_seconds``.
    """
    secret = (configured_secret or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cron endpoint is not configured",
        )
    provided = (provided_secret or "").strip()
    if not provided or not hmac.compare_digest(provided, secret):
        record_security_event_sync(
            action="security.internal_cron.denied",
            metadata={"header": header_name, "reason": "invalid_secret"},
        )
        _log.warning("internal_cron_denied header=%s reason=invalid_secret", header_name)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron credentials")

    if allow_replay_window and cron_timestamp:
        try:
            ts = int(str(cron_timestamp).strip())
        except ValueError:
            record_security_event_sync(
                action="security.internal_cron.denied",
                metadata={"header": header_name, "reason": "invalid_timestamp"},
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron timestamp")
        now = int(time.time())
        if abs(now - ts) > max_skew_seconds:
            record_security_event_sync(
                action="security.internal_cron.denied",
                metadata={"header": header_name, "reason": "stale_timestamp", "skew": abs(now - ts)},
            )
            _log.warning("internal_cron_denied header=%s reason=stale_timestamp skew=%s", header_name, abs(now - ts))
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Stale cron request")
