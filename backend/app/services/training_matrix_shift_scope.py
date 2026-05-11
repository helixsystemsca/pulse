"""Training matrix: map worker roster shift + employment to procedure columns titled with shift bands."""

from __future__ import annotations

from typing import Any, Literal, Optional

MatrixShiftBand = Literal["day", "afternoon", "night"]

MATRIX_SHIFT_KW_PREFIX = "matrix_shift:"


def employment_type_from_scheduling(scheduling: dict[str, Any] | None) -> Optional[str]:
    """Same values as workers API scheduling.employment_type."""
    if not isinstance(scheduling, dict):
        return None
    raw = scheduling.get("employment_type")
    emp = str(raw).strip() if raw is not None else ""
    return emp if emp in ("full_time", "regular_part_time", "part_time") else None


def matrix_shift_band_from_roster_shift(shift: Optional[str]) -> Optional[MatrixShiftBand]:
    """Derive day / afternoon / night from HR.shift roster key or loose labels."""
    s = (shift or "").strip().lower()
    if not s:
        return None
    if s == "day" or (len(s) >= 2 and s[0] == "d" and s[1:].isdigit()):
        return "day"
    if s == "afternoon" or (len(s) >= 2 and s[0] == "a" and s[1:].isdigit()):
        return "afternoon"
    if s in ("night", "overnight") or (len(s) >= 2 and s[0] == "n" and s[1:].isdigit()):
        return "night"
    if "afternoon" in s:
        return "afternoon"
    if "night" in s or "overnight" in s or "grave" in s:
        return "night"
    if "day" in s or "morning" in s:
        return "day"
    return None


def matrix_shift_band_from_procedure_keywords(search_keywords: Any) -> Optional[MatrixShiftBand]:
    """When a procedure `search_keywords` entry is `matrix_shift:day|afternoon|night`, scope it to that band."""
    if not isinstance(search_keywords, (list, tuple)):
        return None
    for raw in search_keywords:
        s = str(raw).strip().lower()
        if not s.startswith(MATRIX_SHIFT_KW_PREFIX):
            continue
        token = s[len(MATRIX_SHIFT_KW_PREFIX) :].strip()
        if token in ("day", "afternoon", "night"):
            return token  # type: ignore[return-value]
        if token in ("d", "days"):
            return "day"
        if token in ("a", "afternoons", "pm"):
            return "afternoon"
        if token in ("n", "nights", "overnight", "grave"):
            return "night"
    return None


def worker_should_see_procedure_for_shift_scoping(
    employment_type: Optional[str],
    worker_band: Optional[MatrixShiftBand],
    procedure_search_keywords: Any,
) -> bool:
    """Part-time and unknown roster band keep full catalog; tagged procedures match worker band only."""
    if employment_type == "part_time":
        return True
    if employment_type not in ("full_time", "regular_part_time"):
        return True
    if worker_band is None:
        return True
    tagged = matrix_shift_band_from_procedure_keywords(procedure_search_keywords)
    if tagged is None:
        return True
    return tagged == worker_band
