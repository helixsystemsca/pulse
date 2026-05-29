"""Internal cron authentication helpers."""

from __future__ import annotations

import time

import pytest
from fastapi import HTTPException

from app.core.security.internal_cron import verify_internal_cron_secret


def test_verify_internal_cron_secret_accepts_valid_key():
    verify_internal_cron_secret(
        configured_secret="super-secret",
        provided_secret="super-secret",
        header_name="X-PM-Cron-Key",
    )


def test_verify_internal_cron_secret_rejects_wrong_key():
    with pytest.raises(HTTPException) as exc:
        verify_internal_cron_secret(
            configured_secret="super-secret",
            provided_secret="wrong",
            header_name="X-PM-Cron-Key",
        )
    assert exc.value.status_code == 401


def test_verify_internal_cron_secret_rejects_stale_timestamp():
    old = str(int(time.time()) - 10_000)
    with pytest.raises(HTTPException):
        verify_internal_cron_secret(
            configured_secret="super-secret",
            provided_secret="super-secret",
            header_name="X-PM-Cron-Key",
            cron_timestamp=old,
            max_skew_seconds=300,
        )
