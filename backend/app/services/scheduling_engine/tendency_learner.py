"""Soft signals from recurring assignment patterns."""

from __future__ import annotations

from datetime import date

from app.services.scheduling_engine.types import HistoricalPatterns


class TendencyLearner:
    def score_tendency(
        self,
        user_id: str,
        *,
        slot_date: date,
        shift_band: str,
        patterns: HistoricalPatterns,
    ) -> tuple[float, list[str]]:
        reasons: list[str] = []
        score = 0.0
        total = patterns.worker_shift_counts.get(user_id, 0)
        if total < 3:
            return 0.0, reasons

        if shift_band == "night":
            n = patterns.worker_overnight_counts.get(user_id, 0)
            ratio = n / total
            if ratio >= 0.35:
                score += 20.0
                reasons.append("historically works overnights")
        if shift_band == "day":
            n = patterns.worker_day_counts.get(user_id, 0)
            ratio = n / total
            if ratio >= 0.35:
                score += 15.0
                reasons.append("historically works days")

        gg = patterns.worker_gg_counts.get(user_id, 0)
        if gg >= 2 and shift_band in ("afternoon", "night"):
            score += 12.0
            reasons.append("recurring GG assignments")

        if slot_date.weekday() >= 5 and total >= 5:
            score += 5.0
            reasons.append("weekend coverage pattern")

        return min(score, 30.0), reasons
