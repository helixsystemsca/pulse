"""Map a published shift to day / afternoon / night for routine checklist variants."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseScheduleShift, PulseScheduleShiftDefinition

RoutineShiftBand = Literal["day", "afternoon", "night"]

VALID_BANDS = frozenset({"day", "afternoon", "night"})


def _band_from_minutes(start_min: int, end_min: int) -> RoutineShiftBand:
    start_min = max(0, min(1439, start_min))
    end_min = max(0, min(1439, end_min))
    start_hour = start_min // 60
    if end_min <= start_min or start_hour >= 22:
        return "night"
    if 14 <= start_hour <= 16:
        return "afternoon"
    if 5 <= start_hour <= 8:
        return "day"
    return "day"


def _normalize_definition_shift_type(raw: str) -> Optional[RoutineShiftBand]:
    s = (raw or "").strip().lower()
    if s in VALID_BANDS:
        return s  # type: ignore[return-value]
    if "after" in s:
        return "afternoon"
    if "night" in s or "overnight" in s or s == "n":
        return "night"
    if s == "d" or "day" in s:
        return "day"
    return None


def band_from_shift_and_definition(
    sh: PulseScheduleShift,
    defn: Optional[PulseScheduleShiftDefinition],
) -> Optional[RoutineShiftBand]:
    if defn is not None:
        normalized = _normalize_definition_shift_type(defn.shift_type or "")
        if normalized:
            return normalized
        return _band_from_minutes(int(defn.start_min or 0), int(defn.end_min or 0))
    sta = sh.starts_at
    end = sh.ends_at
    if sta is None or end is None:
        return None
    if isinstance(sta, datetime) and sta.tzinfo is None:
        sta = sta.replace(tzinfo=timezone.utc)
    if isinstance(end, datetime) and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    sm = sta.hour * 60 + sta.minute
    em = end.hour * 60 + end.minute
    return _band_from_minutes(sm, em)


async def resolve_shift_band_for_shift_id(
    db: AsyncSession,
    company_id: str,
    shift_id: str,
) -> Optional[RoutineShiftBand]:
    sh = await db.get(PulseScheduleShift, shift_id)
    if not sh or str(sh.company_id) != str(company_id):
        return None
    defn: PulseScheduleShiftDefinition | None = None
    if sh.shift_definition_id:
        defn = await db.get(PulseScheduleShiftDefinition, str(sh.shift_definition_id))
        if defn and str(defn.company_id) != str(company_id):
            defn = None
    return band_from_shift_and_definition(sh, defn)


def filter_items_for_shift_band(
    items: list,
    band: Optional[str],
) -> list:
    """
    Include items where shift_band is null (applies to all) or matches `band`.
    If `band` is None (unknown), include all items so runners still see a checklist.
    """
    if band is None:
        return list(items)
    b = str(band).strip().lower()
    out = []
    for it in items:
        sb = getattr(it, "shift_band", None)
        if sb is None or str(sb).strip().lower() == b:
            out.append(it)
    return out
