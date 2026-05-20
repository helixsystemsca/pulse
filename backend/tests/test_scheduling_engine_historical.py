"""Unit tests for historical schedule pattern inference."""

from datetime import date, datetime, time, timezone

from app.services.scheduling_engine.historical_analyzer import HistoricalScheduleAnalyzer


def test_weekday_averages_from_daily_counts():
    analyzer = HistoricalScheduleAnalyzer()
    rows = []
    # Two Mondays with 4 staff each
    for d in (date(2026, 5, 4), date(2026, 5, 11)):
        for i in range(4):
            rows.append(
                {
                    "starts_at": datetime.combine(d, time(9, 0), tzinfo=timezone.utc),
                    "ends_at": datetime.combine(d, time(17, 0), tzinfo=timezone.utc),
                    "shift_type": "day",
                    "assigned_user_id": f"user-{i}",
                    "display_label": None,
                    "is_draft": False,
                }
            )
    patterns = analyzer.analyze(rows, lookback_end=date(2026, 5, 18))
    assert patterns.avg_staff_by_weekday[0] == 4.0
    assert patterns.sample_days >= 2
