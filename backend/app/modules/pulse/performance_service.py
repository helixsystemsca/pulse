"""Worker performance scoring and supervisor insights (tasks + proximity aggregates)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import (
    PulseProject,
    PulseProjectTask,
    PulseProximityEventLog,
    PulseUserPerformanceSnapshot,
)
from app.modules.pulse.accountability_service import equipment_label_for_tag
from app.modules.pulse.task_dependencies import compute_blocking_for_tasks, fetch_prerequisite_ids_for_tasks

STALE_SECONDS = 86400
VALID_TIME_WINDOWS = frozenset({"24h", "7d", "30d"})


def normalize_time_window(key: str) -> str:
    k = (key or "24h").strip().lower()
    return k if k in VALID_TIME_WINDOWS else "24h"


def resolve_time_delta(window_key: str) -> timedelta:
    k = normalize_time_window(window_key)
    if k == "7d":
        return timedelta(days=7)
    if k == "30d":
        return timedelta(days=30)
    return timedelta(hours=24)


def _clamp_score(x: float) -> int:
    return max(0, min(100, int(round(x))))


def _avg_response_penalty(avg_sec: float | None) -> float:
    if avg_sec is None:
        return 0.0
    if avg_sec <= 60:
        return 0.0
    if avg_sec <= 180:
        return 5.0
    if avg_sec <= 600:
        return 15.0
    return 30.0


def responsiveness_score(missed_events: int, avg_response_sec: float | None) -> int:
    base = 100.0 - (5.0 * missed_events) - _avg_response_penalty(avg_response_sec)
    return _clamp_score(base)


def reliability_score(overdue_tasks: int, stale_tasks: int) -> int:
    base = 100.0 - (10.0 * overdue_tasks) - (5.0 * stale_tasks)
    return _clamp_score(base)


async def _company_users(db: AsyncSession, company_id: str) -> dict[str, User]:
    q = await db.execute(
        select(User).where(
            User.company_id == company_id,
            User.is_active.is_(True),
        )
    )
    return {str(u.id): u for u in q.scalars().all()}


@dataclass
class _AssigneeRollup:
    completed_in_window: int = 0
    denom: int = 0
    overdue: int = 0
    stale: int = 0


async def build_operations_insights(
    db: AsyncSession,
    company_id: str,
    time_window_key: str,
) -> dict[str, Any]:
    cid = str(company_id)
    tw = normalize_time_window(time_window_key)
    delta = resolve_time_delta(tw)
    end = datetime.now(timezone.utc)
    start = end - delta
    today: date = end.date()

    users = await _company_users(db, cid)
    roll: dict[str, _AssigneeRollup] = {uid: _AssigneeRollup() for uid in users}

    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.company_id == cid))
    task_orms = list(tq.scalars().all())
    ids = [str(x.id) for x in task_orms]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    needed: set[str] = set(ids)
    for i in ids:
        needed.update(prereq_map.get(i, []))
    if needed != set(ids):
        tq2 = await db.execute(select(PulseProjectTask).where(PulseProjectTask.id.in_(needed)))
        by_id = {str(t.id): t for t in task_orms}
        for t in tq2.scalars().all():
            by_id.setdefault(str(t.id), t)
    else:
        by_id = {str(t.id): t for t in task_orms}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)

    proj_overdue: dict[str, int] = defaultdict(int)
    proj_blocked: dict[str, int] = defaultdict(int)
    loc_overdue: dict[str, int] = defaultdict(int)
    total_overdue = 0
    total_stale = 0

    for t in task_orms:
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        pid = str(t.project_id)
        aid = str(t.assigned_user_id) if t.assigned_user_id else None
        is_bl = block_map[str(t.id)][0]
        is_od = st != "complete" and bool(t.due_date and t.due_date < today)
        is_st = st != "complete" and bool((end - t.updated_at).total_seconds() > STALE_SECONDS)

        if st != "complete":
            if is_od:
                total_overdue += 1
                proj_overdue[pid] += 1
                if aid and aid in roll:
                    roll[aid].overdue += 1
                loc = (t.location_tag_id or "").strip()
                if loc:
                    loc_overdue[loc] += 1
            if is_st:
                total_stale += 1
                if aid and aid in roll:
                    roll[aid].stale += 1
            if is_bl:
                proj_blocked[pid] += 1

        if aid and aid in roll:
            inc_denom = False
            if st != "complete":
                inc_denom = True
            elif t.updated_at and t.updated_at >= start:
                inc_denom = True
            if inc_denom:
                roll[aid].denom += 1
            if st == "complete" and t.updated_at and start <= t.updated_at <= end:
                roll[aid].completed_in_window += 1

    loc_missed: dict[str, int] = defaultdict(int)
    missed_by_user: dict[str, int] = defaultdict(int)
    total_missed = 0

    missed_ref = func.coalesce(PulseProximityEventLog.missed_at, PulseProximityEventLog.detected_at)
    prox_q = await db.execute(
        select(PulseProximityEventLog).where(
            PulseProximityEventLog.company_id == cid,
            or_(
                and_(
                    PulseProximityEventLog.is_missed.is_(True),
                    missed_ref >= start,
                    missed_ref <= end,
                ),
                and_(
                    PulseProximityEventLog.action_taken.is_(True),
                    PulseProximityEventLog.resolved_at.isnot(None),
                    PulseProximityEventLog.resolved_at >= start,
                    PulseProximityEventLog.resolved_at <= end,
                ),
            ),
        )
    )
    prox_logs = list(prox_q.scalars().all())
    response_by_user: dict[str, list[float]] = defaultdict(list)
    for log in prox_logs:
        if log.is_missed:
            total_missed += 1
            missed_by_user[str(log.user_id)] += 1
            loc_missed[log.location_tag_id] += 1
        if log.action_taken and log.resolved_at and start <= log.resolved_at <= end:
            dt = (log.resolved_at - log.detected_at).total_seconds()
            if dt >= 0:
                response_by_user[str(log.user_id)].append(dt)

    proj_q = await db.execute(select(PulseProject).where(PulseProject.company_id == cid))
    project_rows = list(proj_q.scalars().all())
    proj_names = {str(p.id): p.name for p in project_rows}

    user_rows: list[dict[str, Any]] = []
    resp_scores: list[int] = []

    for uid, u in users.items():
        r = roll[uid]
        missed = missed_by_user.get(uid, 0)
        samples = response_by_user.get(uid, [])
        avg_resp = round(sum(samples) / len(samples), 1) if samples else None
        resp = responsiveness_score(missed, avg_resp)
        rel = reliability_score(r.overdue, r.stale)
        denom = r.denom
        completed = r.completed_in_window
        completion_rate = 1.0 if denom == 0 else min(1.0, completed / max(denom, 1))

        user_rows.append(
            {
                "user_id": uid,
                "name": (u.full_name or "").strip() or (u.email or uid),
                "email": u.email,
                "responsiveness_score": resp,
                "reliability_score": rel,
                "tasks_completed": completed,
                "tasks_overdue": r.overdue,
                "tasks_stale": r.stale,
                "missed_proximity_events": missed,
                "avg_response_time_seconds": avg_resp,
                "completion_rate": round(completion_rate, 4),
            }
        )
        resp_scores.append(resp)

    user_rows.sort(key=lambda x: (x["responsiveness_score"], x["reliability_score"]))

    distinct_loc_tags = set(loc_missed.keys()) | set(loc_overdue.keys())
    location_bottlenecks = []
    for tag in sorted(distinct_loc_tags):
        label = await equipment_label_for_tag(db, cid, tag)
        location_bottlenecks.append(
            {
                "location_tag_id": tag,
                "equipment_label": label or tag,
                "missed_events_count": loc_missed.get(tag, 0),
                "overdue_tasks_count": loc_overdue.get(tag, 0),
            }
        )
    location_bottlenecks.sort(key=lambda x: -(x["missed_events_count"] * 3 + x["overdue_tasks_count"]))

    project_bottlenecks = []
    proj_ids = set(proj_overdue.keys()) | set(proj_blocked.keys())
    for pid in sorted(proj_ids):
        project_bottlenecks.append(
            {
                "project_id": pid,
                "project_name": proj_names.get(pid, ""),
                "overdue_tasks": proj_overdue.get(pid, 0),
                "blocked_tasks": proj_blocked.get(pid, 0),
            }
        )
    project_bottlenecks.sort(key=lambda x: -(x["overdue_tasks"] * 2 + x["blocked_tasks"]))

    avg_responsiveness = round(sum(resp_scores) / len(resp_scores), 1) if resp_scores else 0.0

    return {
        "time_window": tw,
        "summary": {
            "total_missed_events": total_missed,
            "total_overdue_tasks": total_overdue,
            "total_stale_tasks": total_stale,
            "avg_responsiveness_score": avg_responsiveness,
        },
        "user_performance": user_rows,
        "location_bottlenecks": location_bottlenecks,
        "project_bottlenecks": project_bottlenecks,
    }


async def compute_user_performance(
    db: AsyncSession,
    company_id: str,
    time_window_key: str,
) -> list[dict[str, Any]]:
    """Per-user metrics and scores (`user_performance` slice of `build_operations_insights`)."""
    data = await build_operations_insights(db, company_id, time_window_key)
    return list(data["user_performance"])


async def persist_performance_snapshots(
    db: AsyncSession,
    company_id: str,
    time_window_key: str,
    user_performance: list[dict[str, Any]],
) -> None:
    cid = str(company_id)
    tw = normalize_time_window(time_window_key)
    now = datetime.now(timezone.utc)
    for row in user_performance:
        payload = {k: v for k, v in row.items() if k not in ("name", "email")}
        insert_stmt = pg_insert(PulseUserPerformanceSnapshot).values(
            user_id=str(row["user_id"]),
            company_id=cid,
            time_window=tw,
            metrics_json=payload,
            computed_at=now,
        )
        upsert = insert_stmt.on_conflict_do_update(
            index_elements=["user_id", "company_id", "time_window"],
            set_={
                "metrics_json": insert_stmt.excluded.metrics_json,
                "computed_at": insert_stmt.excluded.computed_at,
            },
        )
        await db.execute(upsert)
