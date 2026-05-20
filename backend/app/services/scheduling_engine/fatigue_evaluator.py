"""Fatigue and consecutive-shift penalties."""

from __future__ import annotations

from datetime import date, timedelta


class FatigueEvaluator:
    def fatigue_penalty(
        self,
        user_id: str,
        slot_date: date,
        shift_band: str,
        *,
        assigned_by_user_date: dict[tuple[str, date], list[str]],
    ) -> tuple[float, list[str]]:
        penalties = 0.0
        notes: list[str] = []
        prev = slot_date - timedelta(days=1)
        prev2 = slot_date - timedelta(days=2)
        bands_prev = assigned_by_user_date.get((user_id, prev), [])
        bands_prev2 = assigned_by_user_date.get((user_id, prev2), [])

        if shift_band == "night" and "night" in bands_prev:
            penalties += 30.0
            notes.append("consecutive overnight")
        if shift_band == "night" and "night" in bands_prev2 and "night" in bands_prev:
            penalties += 15.0
            notes.append("third-day overnight pattern")

        if len(bands_prev) >= 2:
            penalties += 12.0
            notes.append("back-to-back days scheduled")

        return penalties, notes
