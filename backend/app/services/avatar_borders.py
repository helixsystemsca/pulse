"""Unlockable avatar borders tied to level milestones (Clash-style tiers)."""

from __future__ import annotations

from typing import Any

# level → border id (frontend maps to ring styles)
BORDER_MILESTONES: dict[int, str] = {
    10: "bronze",
    20: "silver",
    30: "gold",
    50: "elite",
}

_BORDER_ORDER = ("bronze", "silver", "gold", "elite")


def merge_unlocked_borders(existing: list[Any] | None, level: int) -> list[str]:
    s = {str(x) for x in (existing or []) if isinstance(x, str) and x}
    for lvl, bid in BORDER_MILESTONES.items():
        if int(level) >= int(lvl):
            s.add(bid)
    return [b for b in _BORDER_ORDER if b in s]
