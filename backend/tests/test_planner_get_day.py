"""Daily planner get_day payload and timezone helpers."""

from datetime import date

from app.schemas.planner import PlannerDayOut
from app.services.planner.planner_service import _tz
from app.services.planner.scheduling_engine import EngineConfig, EngineRoutine, build_day


def test_tz_resolves() -> None:
    tz = _tz()
    assert tz.key in {"America/Vancouver", "UTC"}


def test_empty_day_engine_builds_blocks() -> None:
    planned, displacements = build_day(
        today=date(2026, 8, 25),
        tasks=[],
        routines=[
            EngineRoutine(
                id="r1",
                name="Email / Communications",
                category_slug="communications",
                start_min=6 * 60,
                end_min=6 * 60 + 30,
                protected=True,
                flexible=False,
                priority=80,
            )
        ],
        events=[],
        cfg=EngineConfig(work_start_min=6 * 60, work_end_min=16 * 60 + 30),
    )
    assert planned
    assert displacements == []


def test_day_out_accepts_serialized_empty_interruption() -> None:
    payload = {
        "date": date(2026, 8, 22),
        "day_label": "Saturday",
        "work_start": "06:00:00",
        "work_end": "16:30:00",
        "completion_pct": 0,
        "now": None,
        "next": None,
        "at_risk": [],
        "timeline": [],
        "open_interruption": None,
        "metrics": {},
    }
    out = PlannerDayOut.model_validate(payload)
    assert out.day_label == "Saturday"
    assert out.timeline == []
