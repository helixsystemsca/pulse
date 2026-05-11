"""Professional tier titles and cumulative XP thresholds (configurable per company via JSON)."""

from __future__ import annotations

from typing import Any, Sequence

# Default cumulative XP thresholds: tier T requires total_xp >= DEFAULT_THRESHOLDS[T-1]
DEFAULT_PROFESSIONAL_THRESHOLDS: tuple[int, ...] = (0, 100, 250, 500, 900, 1400, 2000)


def _extended_thresholds(base: Sequence[int], max_level: int = 40) -> list[int]:
    th = [int(x) for x in base]
    if not th or th[0] != 0:
        th = [0] + th
    while len(th) <= max_level:
        step = 600 + (len(th) - 8) * 120 if len(th) >= 8 else 500
        th.append(th[-1] + max(400, step))
    return th


def professional_thresholds_list(company_override: list[Any] | None) -> list[int]:
    if isinstance(company_override, list) and company_override:
        try:
            vals = sorted(int(x) for x in company_override if x is not None)
            if vals and vals[0] == 0:
                return _extended_thresholds(vals)
            if vals:
                return _extended_thresholds([0] + vals)
        except (TypeError, ValueError):
            pass
    return _extended_thresholds(DEFAULT_PROFESSIONAL_THRESHOLDS)


def professional_level_from_total_xp(total_xp: int, company_override: list[Any] | None = None) -> int:
    th = professional_thresholds_list(company_override)
    t = max(0, int(total_xp))
    lvl = 1
    for i in range(1, len(th)):
        if t >= th[i]:
            lvl = i + 1
        else:
            break
    return lvl


def professional_title_for_level(level: int) -> str:
    titles = (
        "Operator I",
        "Operator II",
        "Senior Operator",
        "Lead Operator",
        "Systems Specialist",
        "Reliability Leader",
        "Compliance Champion",
    )
    if level <= 1:
        return titles[0]
    if level <= len(titles):
        return titles[level - 1]
    return titles[-1]


def professional_xp_progress(total_xp: int, company_override: list[Any] | None = None) -> tuple[int, str, int, int]:
    """
    Returns (professional_level, title, xp_into_current_tier, xp_span_for_current_tier).
    """
    th = professional_thresholds_list(company_override)
    t = max(0, int(total_xp))
    lvl = professional_level_from_total_xp(t, company_override)
    start = th[lvl - 1] if lvl - 1 < len(th) else th[-1]
    into = max(0, t - start)
    if lvl < len(th):
        seg = max(1, th[lvl] - start)
    else:
        seg = max(1, th[-1] - th[-2])
    return lvl, professional_title_for_level(lvl), into, seg
