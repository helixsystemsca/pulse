"""Lightweight hooks for suspicious activity (extensible to SIEM / alerting)."""

from __future__ import annotations

import logging
from typing import Any, Optional

_log = logging.getLogger("pulse.security.suspicious")


def note_suspicious_activity(
    *,
    kind: str,
    actor_user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """
    Structured warning for patterns that may warrant investigation.

    Does not block the request — pair with audit rows and rate limits for enforcement.
    """
    _log.warning(
        "suspicious_activity kind=%s actor=%s company=%s request_id=%s meta=%s",
        kind,
        actor_user_id or "-",
        company_id or "-",
        request_id or "-",
        metadata or {},
    )
