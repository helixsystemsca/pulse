"""
Example XP policy knobs (reason codes map to copy for UI).

Operational grants use ``try_grant_xp`` with ``reason_code`` + optional ``reason`` text;
see ``xp_reasons.display_reason`` for defaults.
"""

from __future__ import annotations

# Streak milestone bonus XP (applied once per milestone via dedupe keys in streak service).
STREAK_BONUS_XP: dict[int, int] = {
    3: 10,
    7: 25,
    30: 120,
    100: 400,
}

# Manager-awarded bonus caps (per request validation).
MANAGER_BONUS_XP_MAX = 500
MANAGER_BONUS_XP_MIN = 1
