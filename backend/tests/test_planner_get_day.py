"""Daily planner get_day payload and timezone helpers."""

from datetime import date, time

from app.schemas.planner import PlannerDayOut
from app.services.planner.planner_service import PlannerConflict, _tz, _validated_range
from app.services.planner.scheduling_engine import EngineConfig, EngineRoutine, build_day, hour_template_slots


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


def test_hour_template_matches_default_workday() -> None:
    slots = hour_template_slots(8 * 60 + 30, 16 * 60 + 30)
    assert [s[0] for s in slots] == [
        8 * 60 + 30,
        9 * 60 + 30,
        10 * 60 + 30,
        11 * 60 + 30,
        12 * 60 + 30,
        13 * 60 + 30,
        14 * 60 + 30,
        15 * 60 + 30,
    ]


def test_validated_range_allows_touching_edges() -> None:
    start, end = _validated_range(
        time(9, 30),
        time(10, 30),
        [(8 * 60 + 30, 9 * 60 + 30)],
        time(8, 30),
        time(16, 30),
    )
    assert (start, end) == (9 * 60 + 30, 10 * 60 + 30)


def test_validated_range_rejects_overlap_and_short_blocks() -> None:
    try:
        _validated_range(time(9, 0), time(10, 0), [(8 * 60 + 30, 9 * 60 + 30)], time(8, 30), time(16, 30))
        raise AssertionError("expected overlap conflict")
    except PlannerConflict:
        pass
    try:
        _validated_range(time(9, 30), time(9, 37), [], time(8, 30), time(16, 30))
        raise AssertionError("expected short-block conflict")
    except PlannerConflict:
        pass
