"""Deterministic scheduling engine tests — no database."""

from datetime import date

from app.services.planner.scheduling_engine import (
    EngineConfig,
    EngineEvent,
    EngineRoutine,
    EngineTask,
    PlannedBlock,
    at_risk_tasks,
    build_day,
    current_and_next,
    score_task,
    subtract_intervals,
)


TODAY = date(2026, 8, 25)


def _task(**kwargs: object) -> EngineTask:
    defaults: dict[str, object] = {
        "id": "t1",
        "title": "Task",
        "category_slug": "operations",
        "priority": "medium",
        "priority_score": 0,
        "estimated_minutes": 30,
        "due_date": None,
        "deadline": None,
        "delay_count": 0,
        "waiting_days": 0,
        "status": "not_started",
    }
    defaults.update(kwargs)
    return EngineTask(**defaults)  # type: ignore[arg-type]


def test_meeting_cuts_protected_routine() -> None:
    remaining = subtract_intervals([(8 * 60 + 30, 9 * 60 + 30)], [(8 * 60 + 30, 9 * 60)])
    assert remaining == [(9 * 60, 9 * 60 + 30)]


def test_asset_block_picks_highest_priority_that_fits() -> None:
    tasks = [
        _task(id="compressor", title="Replace compressor", category_slug="asset_management", priority="high", estimated_minutes=120),
        _task(id="record", title="Update asset record", category_slug="asset_management", priority="medium", estimated_minutes=30),
        _task(id="lifecycle", title="Review lifecycle plan", category_slug="asset_management", priority="high", estimated_minutes=60),
        _task(id="warranty", title="Check warranty documentation", category_slug="asset_management", priority="low", estimated_minutes=30),
    ]
    planned, _ = build_day(
        today=TODAY,
        tasks=tasks,
        routines=[
            EngineRoutine(
                id="r1",
                name="Asset Management",
                category_slug="asset_management",
                start_min=7 * 60 + 30,
                end_min=8 * 60 + 30,
                protected=True,
                flexible=False,
                priority=80,
            )
        ],
        events=[],
        cfg=EngineConfig(work_start_min=6 * 60, work_end_min=16 * 60 + 30),
    )
    asset = [b for b in planned if b.routine_block_id == "r1" and b.task_id]
    assert asset, planned
    assert asset[0].task_id == "lifecycle"


def test_meeting_overrides_and_records_displacement() -> None:
    tasks = [
        _task(id="maint", title="Maintenance planning", category_slug="maintenance", priority="high", estimated_minutes=60),
    ]
    previous = [
        PlannedBlock(
            start_min=8 * 60 + 30,
            end_min=9 * 60 + 30,
            block_type="task",
            title="Maintenance planning",
            category_slug="maintenance",
            task_id="maint",
        )
    ]
    planned, displacements = build_day(
        today=TODAY,
        tasks=tasks,
        routines=[
            EngineRoutine(
                id="r-m",
                name="Maintenance",
                category_slug="maintenance",
                start_min=8 * 60 + 30,
                end_min=9 * 60 + 30,
                protected=True,
                flexible=False,
                priority=80,
            )
        ],
        events=[EngineEvent(id="ev1", title="Capital projects meeting", start_min=8 * 60 + 30, end_min=9 * 60)],
        previous=previous,
        cfg=EngineConfig(work_start_min=8 * 60 + 30, work_end_min=16 * 60 + 30),
    )
    meetings = [b for b in planned if b.block_type == "meeting"]
    assert len(meetings) == 1
    assert meetings[0].title == "Capital projects meeting"
    assert displacements
    assert displacements[0].task_id == "maint"
    assert displacements[0].reason == "meeting"


def test_overdue_scores_higher_than_due_today() -> None:
    overdue = _task(id="a", title="Overdue", priority="medium", deadline=date(2026, 8, 20))
    due = _task(id="b", title="Due today", priority="medium", deadline=TODAY)
    cfg = EngineConfig()
    s_over = score_task(overdue, today=TODAY, slot_category=None, slot_minutes=60, allocated_share={}, cfg=cfg)
    s_due = score_task(due, today=TODAY, slot_category=None, slot_minutes=60, allocated_share={}, cfg=cfg)
    assert s_over > s_due


def test_current_and_next() -> None:
    blocks = [
        PlannedBlock(start_min=360, end_min=390, block_type="task", title="Email"),
        PlannedBlock(start_min=390, end_min=450, block_type="task", title="SOP"),
    ]
    cur, nxt = current_and_next(blocks, 400)
    assert cur is not None and cur.title == "SOP"
    assert nxt is None


def test_at_risk_includes_overdue_and_repeated() -> None:
    tasks = [
        _task(id="1", title="Overdue SOP", deadline=date(2026, 8, 1), status="not_started"),
        _task(id="2", title="Deferred twice", delay_count=2, status="deferred"),
        _task(id="3", title="Done", status="complete", deadline=date(2026, 8, 1)),
    ]
    risk = at_risk_tasks(tasks, TODAY, scheduled_ids=set())
    ids = {t.id for t in risk}
    assert "1" in ids
    assert "2" in ids
    assert "3" not in ids
