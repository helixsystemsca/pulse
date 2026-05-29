"""Refresh token helpers (phase 2)."""

from app.core.auth.refresh_tokens import _hash_refresh_token, generate_refresh_token, refresh_sessions_enabled
from app.core.config import Settings


def test_generate_refresh_token_length():
    raw = generate_refresh_token()
    assert len(raw) >= 32


def test_hash_refresh_token_stable():
    raw = "test-token-value"
    assert _hash_refresh_token(raw) == _hash_refresh_token(raw)


def test_refresh_disabled_in_bearer_mode():
    assert refresh_sessions_enabled(Settings(auth_session_mode="bearer")) is False


def test_refresh_enabled_in_dual_mode():
    assert refresh_sessions_enabled(Settings(auth_session_mode="dual")) is True
