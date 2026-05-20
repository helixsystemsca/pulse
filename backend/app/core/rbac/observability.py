"""Structured logging for authorization decisions (denials, suspicious patterns)."""

from __future__ import annotations

import logging
from typing import Any

_logger = logging.getLogger("pulse.rbac")


def log_rbac_denial(
    *,
    user_id: str | None,
    company_id: str | None,
    required_any_of: tuple[str, ...],
    held_keys_sample: list[str] | None,
    mode: str = "any",
    route: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Emit a single WARNING line for denied RBAC checks (parseable in log pipelines)."""
    payload = {
        "event": "rbac.denied",
        "user_id": user_id,
        "company_id": company_id,
        "required_any_of": list(required_any_of),
        "mode": mode,
        "route": route,
        "held_keys_sample": held_keys_sample,
    }
    if extra:
        payload.update(extra)
    _logger.warning("%s", payload)
