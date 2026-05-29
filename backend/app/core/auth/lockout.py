"""Account lockout with optional exponential backoff."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.config import Settings
from app.models.domain import User


def lockout_duration_minutes(settings: Settings, failed_attempts: int) -> int:
    """Exponential backoff capped at 8× base lockout after repeated lock cycles."""
    base = max(settings.login_lockout_minutes, 1)
    if not settings.login_lockout_exponential:
        return base
    max_attempts = max(settings.login_lockout_max_attempts, 1)
    cycle = max(0, (failed_attempts // max_attempts) - 1)
    multiplier = min(2**cycle, 8)
    return base * multiplier


def apply_failed_login_lockout(user: User, settings: Settings, now: datetime | None = None) -> None:
    now = now or datetime.now(timezone.utc)
    user.failed_login_attempts = int(getattr(user, "failed_login_attempts", 0) or 0) + 1
    if user.failed_login_attempts >= settings.login_lockout_max_attempts:
        minutes = lockout_duration_minutes(settings, user.failed_login_attempts)
        user.locked_until = now + timedelta(minutes=minutes)


def clear_login_lockout(user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
