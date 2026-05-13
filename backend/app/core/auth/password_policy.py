"""Password strength rules for newly chosen passwords (invites, resets, profile change)."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings


def validate_new_password(plain: str, settings: "Settings") -> None:
    """
    Enforce tenant password policy.

    Raises:
        ValueError: with a single user-facing message when the password is not acceptable.
    """
    pw = (plain or "").strip()
    if not pw:
        raise ValueError("Password is required")
    min_len = int(settings.password_min_length)
    if len(pw) < min_len:
        raise ValueError(f"Password must be at least {min_len} characters")
    if len(pw) > 128:
        raise ValueError("Password must be at most 128 characters")
    if not settings.password_require_character_classes:
        return

    has_upper = bool(re.search(r"[A-Z]", pw))
    has_lower = bool(re.search(r"[a-z]", pw))
    has_digit = bool(re.search(r"\d", pw))
    has_special = bool(re.search(r"[^A-Za-z0-9\s]", pw))
    score = sum(1 for x in (has_upper, has_lower, has_digit, has_special) if x)
    if score < 3:
        raise ValueError(
            "Password must include at least three of: uppercase letter, lowercase letter, number, symbol"
        )
