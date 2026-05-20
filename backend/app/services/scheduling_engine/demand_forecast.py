"""Predict staffing requirements from historical patterns and demand drivers."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from app.services.scheduling_engine.types import HistoricalPatterns, StaffingRequirement


class DemandForecastService:
    """Builds operational staffing targets (not assignments)."""

    def forecast(
        self,
        *,
        period_start: date,
        period_end: date,
        patterns: HistoricalPatterns,
        ft_absence_counts: dict[date, int],
        event_dates: set[date] | None = None,
        zone_id: str | None = None,
    ) -> list[StaffingRequirement]:
        event_dates = event_dates or set()
        requirements: list[StaffingRequirement] = []
        d = period_start
        while d <= period_end:
            wd = d.weekday()
            base = patterns.avg_staff_by_weekday.get(wd, 3.0)
            if wd >= 5:
                base *= 1.08
            if d in event_dates:
                base *= 1.15

            absences = ft_absence_counts.get(d, 0)
            if absences:
                base += min(absences * 0.85, 4.0)

            for band, band_avg in patterns.avg_staff_by_shift_type.items():
                share = band_avg / max(sum(patterns.avg_staff_by_shift_type.values()), 0.01)
                count = max(1, int(round(base * share)))
                if band == "night" and patterns.overnight_share > 0.35:
                    count = max(count, int(round(base * 0.35)))

                required_certs: list[str] = []
                if patterns.cert_ratios.get("RO", 0) > 0.08:
                    required_certs.append("RO")
                if band == "night" and patterns.cert_ratios.get("GG", 0) > 0.05:
                    required_certs.append("GG")

                conf = 0.55
                if patterns.sample_days >= 14:
                    conf = 0.72
                if patterns.sample_days >= 45:
                    conf = 0.82

                requirements.append(
                    StaffingRequirement(
                        id=str(uuid.uuid4()),
                        date=d,
                        shift_type=band,
                        required_count=count,
                        required_certifications=required_certs,
                        zone_id=zone_id,
                        source="inferred_historical",
                        confidence_score=conf,
                    )
                )
            d += timedelta(days=1)
        return requirements
