"""Non-linear XP → level curve (fast early, moderate mid, slower tail)."""

from __future__ import annotations

from functools import lru_cache

MAX_LEVEL = 199


@lru_cache
def cumulative_xp_thresholds() -> tuple[int, ...]:
    """
    ``thresholds[L]`` = minimum total XP to **be** level ``L+1`` (1-based level).

    ``thresholds[0] == 0`` (level 1 starts at 0 XP).
    """
    thresholds: list[int] = [0]
    total = 0
    for current_level in range(1, MAX_LEVEL + 1):
        if current_level <= 5:
            need = 40 + (current_level - 1) * 10
        elif current_level <= 15:
            need = 85 + (current_level - 6) * 15
        else:
            need = int(220 * (1.07 ** (current_level - 15)))
        total += need
        thresholds.append(total)
    return tuple(thresholds)


def level_from_total_xp(total_xp: int) -> int:
    th = cumulative_xp_thresholds()
    t = max(0, int(total_xp))
    for lvl in range(len(th) - 1, 0, -1):
        if t >= th[lvl - 1]:
            return lvl
    return 1


def xp_progress(total_xp: int) -> tuple[int, int, int]:
    """
    Returns ``(level, xp_into_current_level, xp_required_for_this_level_segment)``.

    The segment size is the span from ``thresholds[level-1]`` to ``thresholds[level]``.
    """
    th = cumulative_xp_thresholds()
    t = max(0, int(total_xp))
    lvl = level_from_total_xp(t)
    start = th[lvl - 1]
    into = t - start
    if lvl >= len(th) - 1:
        segment = max(1, th[-1] - th[-2])
    else:
        segment = max(1, th[lvl] - start)
    return lvl, into, segment


def xp_to_next_level(total_xp: int) -> int:
    """How many XP until the next level threshold (0 if exactly on boundary is rare)."""
    lvl, into, segment = xp_progress(total_xp)
    return max(0, segment - into)
