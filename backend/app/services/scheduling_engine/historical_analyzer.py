"""Analyze historical schedules to infer staffing patterns."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from app.services.scheduling_engine.types import HistoricalPatterns

_ABSENCE_TYPES = frozenset({"vacation", "sick", "pto", "absence"})
_ABSENCE_LABELS = frozenset({"a", "vac", "pto", "sick", "absence"})


def _shift_band(shift_type: str, start_min: int) -> str:
    st = (shift_type or "shift").lower()
    if st in ("day", "morning", "d1", "d2"):
        return "day"
    if st in ("afternoon", "pm", "pm1", "pm2", "evening"):
        return "afternoon"
    if st in ("night", "overnight", "n1", "n2", "graveyard"):
        return "night"
    if start_min < 12 * 60:
        return "day"
    if start_min < 17 * 60:
        return "afternoon"
    return "night"


def _is_absence(shift_type: str, display_label: str | None) -> bool:
    if (shift_type or "").lower() in _ABSENCE_TYPES:
        return True
    if display_label and display_label.strip().lower() in _ABSENCE_LABELS:
        return True
    return False


def _start_min(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


class HistoricalScheduleAnalyzer:
    """Derives operational patterns from past schedule rows."""

    def analyze(
        self,
        shifts: list[dict],
        *,
        lookback_end: date,
    ) -> HistoricalPatterns:
        """
        Each shift dict: starts_at, ends_at, shift_type, assigned_user_id,
        display_label, employment_type (optional on join), is_draft.
        """
        by_weekday: dict[int, list[int]] = defaultdict(list)
        by_band: dict[str, list[int]] = defaultdict(list)
        cert_hits: dict[str, int] = defaultdict(int)
        total_work = 0
        aux_work = 0
        overnight_work = 0
        worker_shift: dict[str, int] = defaultdict(int)
        worker_overnight: dict[str, int] = defaultdict(int)
        worker_gg: dict[str, int] = defaultdict(int)
        worker_day: dict[str, int] = defaultdict(int)
        days_seen: set[date] = set()

        # Count staffed slots per calendar day for weekday averages
        daily_counts: dict[date, int] = defaultdict(int)

        for row in shifts:
            if row.get("is_draft"):
                continue
            st = row.get("shift_type") or "shift"
            label = row.get("display_label")
            if _is_absence(st, label):
                continue
            uid = row.get("assigned_user_id")
            if not uid:
                continue

            starts = row["starts_at"]
            if isinstance(starts, str):
                starts = datetime.fromisoformat(starts.replace("Z", "+00:00"))
            d = starts.date() if hasattr(starts, "date") else lookback_end
            days_seen.add(d)
            daily_counts[d] += 1

            sm = _start_min(starts)
            band = _shift_band(st, sm)
            by_weekday[d.weekday()].append(1)
            by_band[band].append(1)
            total_work += 1

            emp = (row.get("employment_type") or "").lower()
            if emp in ("auxiliary", "aux", "casual", "on_call"):
                aux_work += 1
            if band == "night":
                overnight_work += 1
                worker_overnight[str(uid)] += 1

            worker_shift[str(uid)] += 1
            if band == "day":
                worker_day[str(uid)] += 1

            dl = (label or "").upper()
            if "GG" in dl or st.lower() == "gg":
                worker_gg[str(uid)] += 1
                cert_hits["GG"] += 1

            meta = row.get("required_certifications") or []
            for c in meta:
                cert_hits[str(c).upper()] += 1

        sample_days = max(len(days_seen), 1)
        avg_by_wd: dict[int, float] = {}
        for wd in range(7):
            vals = [c for day, c in daily_counts.items() if day.weekday() == wd]
            if vals:
                avg_by_wd[wd] = sum(vals) / len(vals)
        if not avg_by_wd and daily_counts:
            overall = sum(daily_counts.values()) / sample_days
            avg_by_wd = {i: overall for i in range(7)}
        if not avg_by_wd:
            avg_by_wd = {i: 3.0 for i in range(7)}

        avg_by_band: dict[str, float] = {}
        for band, counts in by_band.items():
            avg_by_band[band] = len(counts) / sample_days if sample_days else 3.0
        for default_band in ("day", "afternoon", "night"):
            avg_by_band.setdefault(default_band, sum(avg_by_wd.values()) / max(len(avg_by_wd), 1) / 3.0)

        cert_total = sum(cert_hits.values()) or 1
        cert_ratios = {k: v / cert_total for k, v in cert_hits.items()}

        return HistoricalPatterns(
            avg_staff_by_weekday=avg_by_wd,
            avg_staff_by_shift_type=avg_by_band,
            cert_ratios=cert_ratios,
            auxiliary_share=aux_work / max(total_work, 1),
            overnight_share=overnight_work / max(total_work, 1),
            worker_shift_counts=dict(worker_shift),
            worker_overnight_counts=dict(worker_overnight),
            worker_gg_counts=dict(worker_gg),
            worker_day_counts=dict(worker_day),
            sample_days=sample_days,
        )
