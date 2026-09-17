"""Daily Operations Planner: place-on-today, Open capacity, locks, interruptions."""

from __future__ import annotations

from datetime import date, time
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.core.features.cache import clear_all
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkRequest
from app.models.planner_models import PlannerTask
from app.services.planner import planner_service as svc
from app.services.planner.planner_service import _minutes_of


DAY = date(2026, 9, 17)


async def _admin_token(db_session: AsyncSession, seeded_tenant) -> str:
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    clear_all()
    return create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ids(seeded_tenant) -> tuple[str, str]:
    return seeded_tenant.company_id, seeded_tenant.manager_id


@pytest.mark.asyncio
async def test_place_on_today_places_inbox_tasks_without_resetting_day(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    before = await svc._day_blocks(db_session, cid, uid, DAY)
    open_before = [b for b in before if b.block_type == "open"]
    assert len(open_before) == 8

    meeting = await svc.create_block(
        db_session,
        cid,
        uid,
        {
            "date": DAY,
            "start_time": time(12, 30),
            "end_time": time(13, 30),
            "title": "Capital projects meeting",
            "block_type": "meeting",
        },
    )
    task = await svc.create_task(
        db_session,
        cid,
        uid,
        {"title": "Pool shutdown SOP", "estimated_minutes": 45, "priority": "high"},
    )

    result = await svc.place_inbox_on_day(db_session, cid, uid, DAY, task_ids=[str(task.id)])
    blocks = result.blocks
    placed = [b for b in blocks if str(b.task_id) == str(task.id)]
    assert result.placed_count == 1
    assert "Placed 1 task" in result.message
    assert placed, [b.title for b in blocks]
    assert placed[0].block_type == "task"
    assert placed[0].title == "Pool shutdown SOP"
    kept_meeting = next(b for b in blocks if str(b.id) == str(meeting.id))
    assert kept_meeting.title == "Capital projects meeting"
    leftover_open = [b for b in blocks if b.block_type == "open"]
    assert leftover_open
    assert sum(_minutes_of(b.end_time) - _minutes_of(b.start_time) for b in leftover_open) < 8 * 60


@pytest.mark.asyncio
async def test_quick_add_splits_open_capacity(db_session: AsyncSession, seeded_tenant) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    row = await svc.create_block(
        db_session,
        cid,
        uid,
        {
            "date": DAY,
            "start_time": time(8, 30),
            "end_time": time(9, 30),
            "title": "Review ammonia plant inspection",
            "block_type": "task",
        },
    )
    assert row.block_type == "task"
    assert row.task_id
    blocks = await svc._day_blocks(db_session, cid, uid, DAY)
    overlapping_open = [
        b
        for b in blocks
        if b.block_type == "open"
        and _minutes_of(b.start_time) < 9 * 60 + 30
        and _minutes_of(b.end_time) > 8 * 60 + 30
    ]
    assert overlapping_open == []
    assert any(b.title == "Review ammonia plant inspection" for b in blocks)
    assert any(b.block_type == "open" for b in blocks)


@pytest.mark.asyncio
async def test_move_block_rejects_locked_meeting(db_session: AsyncSession, seeded_tenant) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    meeting = await svc.create_block(
        db_session,
        cid,
        uid,
        {
            "date": DAY,
            "start_time": time(9, 30),
            "end_time": time(10, 30),
            "title": "Staff briefing",
            "block_type": "meeting",
        },
    )
    assert meeting.locked
    try:
        await svc.move_block(db_session, cid, uid, str(meeting.id), time(11, 30), time(12, 30), "personal_manual")
        raise AssertionError("expected locked meeting to reject move")
    except svc.PlannerConflict as exc:
        assert "cannot be moved" in str(exc).lower()


@pytest.mark.asyncio
async def test_interruption_creates_work_request_and_sensible_duration(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    row, extras = await svc.start_interruption(
        db_session,
        cid,
        uid,
        {
            "reason": "emergency",
            "notes": "Ammonia alarm at ice plant",
            "create_work_request": True,
            "duration_minutes": 60,
        },
    )
    assert extras["work_request_id"]
    assert extras["work_request_warning"] is None
    wr = await db_session.get(PulseWorkRequest, extras["work_request_id"])
    assert wr is not None
    assert wr.company_id == cid
    assert "Ammonia" in wr.title
    blocks = await svc._day_blocks(db_session, cid, uid, row.start_time.date())
    interrupt = [b for b in blocks if b.block_type == "interruption"]
    assert interrupt
    mins = _minutes_of(interrupt[0].end_time) - _minutes_of(interrupt[0].start_time)
    assert mins >= 60
    assert interrupt[0].locked


@pytest.mark.asyncio
async def test_interruption_warns_when_work_request_fails(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    with patch(
        "app.modules.work_requests.work_order_number.allocate_work_order_number",
        side_effect=RuntimeError("allocator down"),
    ):
        row, extras = await svc.start_interruption(
            db_session,
            cid,
            uid,
            {"reason": "emergency", "notes": "Pool chemical", "create_work_request": True, "duration_minutes": 30},
        )
    assert row.id
    assert extras["work_request_id"] is None
    assert extras["work_request_warning"]
    blocks = await svc._day_blocks(db_session, cid, uid, row.start_time.date())
    assert any(b.block_type == "interruption" for b in blocks)


@pytest.mark.asyncio
async def test_completing_task_block_moves_completion_meter(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    task = await svc.create_task(db_session, cid, uid, {"title": "SOP review", "estimated_minutes": 30})
    await svc.place_inbox_on_day(db_session, cid, uid, DAY, task_ids=[str(task.id)])
    before = await svc.persist_daily_metrics(db_session, cid, uid, DAY)
    assert before.scheduled_count >= 1
    assert before.completion_pct == 0
    await svc.complete_task(db_session, cid, uid, str(task.id))
    after = await svc.persist_daily_metrics(db_session, cid, uid, DAY)
    assert after.completed_count >= 1
    assert after.completion_pct > 0


@pytest.mark.asyncio
async def test_place_on_today_http_endpoint(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    created = await client.post(
        "/api/v1/planner/tasks",
        headers=headers,
        json={"title": "Walkdown rink 2", "estimated_minutes": 30, "priority": "medium"},
    )
    assert created.status_code == 200, created.text
    task_id = created.json()["id"]
    placed = await client.post(
        "/api/v1/planner/day/place",
        headers=headers,
        json={"date": DAY.isoformat(), "task_ids": [task_id]},
    )
    assert placed.status_code == 200, placed.text
    body = placed.json()
    timeline = body["timeline"]
    assert any(row.get("task_id") == task_id for row in timeline)
    assert body["placed_count"] == 1
    assert task_id in body["placed_task_ids"]
    assert "Placed 1 task" in body["message"]
    generate = await client.post(
        f"/api/v1/planner/day/generate?date={DAY.isoformat()}",
        headers=headers,
    )
    assert generate.status_code == 200, generate.text
    assert any(row.get("block_type") == "open" for row in generate.json()["timeline"])
    deleted = await client.delete(f"/api/v1/planner/tasks/{task_id}", headers=headers)
    assert deleted.status_code == 204, deleted.text


@pytest.mark.asyncio
async def test_place_on_today_explains_when_nothing_to_place(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    empty = await svc.place_inbox_on_day(
        db_session, cid, uid, DAY, task_ids=["00000000-0000-0000-0000-000000000000"]
    )
    assert empty.placed_count == 0
    assert "No schedulable tasks" in empty.message

    blocked = await svc.create_task(
        db_session, cid, uid, {"title": "Waiting on contractor", "estimated_minutes": 30}
    )
    blocked.status = "blocked"
    await db_session.flush()
    skipped = await svc.place_inbox_on_day(db_session, cid, uid, DAY, task_ids=[str(blocked.id)])
    assert skipped.placed_count == 0
    assert "No schedulable tasks" in skipped.message


@pytest.mark.asyncio
async def test_place_on_today_explains_when_day_is_full(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    start = 8 * 60 + 30
    for i in range(8):
        await svc.create_block(
            db_session,
            cid,
            uid,
            {
                "date": DAY,
                "start_time": time((start + i * 60) // 60, (start + i * 60) % 60),
                "end_time": time((start + (i + 1) * 60) // 60, (start + (i + 1) * 60) % 60),
                "title": f"Locked meeting {i + 1}",
                "block_type": "meeting",
            },
        )
    task = await svc.create_task(
        db_session, cid, uid, {"title": "QA inbox task - reversible", "estimated_minutes": 30}
    )
    result = await svc.place_inbox_on_day(db_session, cid, uid, DAY, task_ids=[str(task.id)])
    assert result.placed_count == 0
    assert "full" in result.message.lower()
    assert "QA inbox task - reversible" in result.unplaced_titles


@pytest.mark.asyncio
async def test_delete_inbox_task_restores_open_capacity(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid, uid = _ids(seeded_tenant)
    await svc.generate_hour_template(db_session, cid, uid, DAY)
    task = await svc.create_task(
        db_session, cid, uid, {"title": "QA inbox task - reversible", "estimated_minutes": 30}
    )
    placed = await svc.place_inbox_on_day(db_session, cid, uid, DAY, task_ids=[str(task.id)])
    assert placed.placed_count == 1
    await svc.delete_task(db_session, cid, uid, str(task.id))
    remaining = await svc._day_blocks(db_session, cid, uid, DAY)
    assert all(str(b.task_id) != str(task.id) for b in remaining)
    assert any(b.block_type == "open" and b.title == "Open" for b in remaining)
    gone = await db_session.get(PlannerTask, task.id)
    assert gone is None
