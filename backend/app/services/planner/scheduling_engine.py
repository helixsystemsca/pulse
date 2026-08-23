"""Deterministic daily scheduling engine — no I/O, no FastAPI.

The planner service loads rows, calls ``build_day``, then persists the result.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable

from app.services.planner.constants import DEFAULT_WEIGHTS, HOUR_SLOT_MINUTES, PRIORITY_RANK, SNAP_MINUTES


def hhmm_to_minutes(value: str) -> int:
    parts = (value or "00:00").split(":")
    h = int(parts[0] or 0)
    m = int(parts[1] or 0) if len(parts) > 1 else 0
    return max(0, min(24 * 60, h * 60 + m))


def minutes_to_hhmm(total: int) -> str:
    total = max(0, min(24 * 60 - 1, int(total)))
    return f"{total // 60:02d}:{total % 60:02d}"


def snap_minutes(total: int, snap: int = SNAP_MINUTES) -> int:
    return int(round(int(total) / snap) * snap)


def hour_template_slots(
    work_start_min: int,
    work_end_min: int,
    *,
    slot_minutes: int = HOUR_SLOT_MINUTES,
    snap: int = SNAP_MINUTES,
    occupied: list[tuple[int, int]] | None = None,
) -> list[tuple[int, int]]:
    """Fill the work window with ``slot_minutes`` blocks, skipping occupied ranges.

    Leftover free time of at least ``snap`` minutes becomes its own shorter block
    so a condensed day can still host extra items.
    """
    start = snap_minutes(work_start_min, snap)
    end = snap_minutes(work_end_min, snap)
    if end <= start:
        return []
    free = subtract_intervals([(start, end)], list(occupied or []))
    out: list[tuple[int, int]] = []
    for a, b in free:
        cursor = a
        while cursor + snap <= b:
            nxt = min(cursor + slot_minutes, b)
            if nxt - cursor < snap:
                break
            out.append((cursor, nxt))
            cursor = nxt
    return out


def free_gaps(
    work_start_min: int,
    work_end_min: int,
    occupied: list[tuple[int, int]] | None = None,
    *,
    min_minutes: int = SNAP_MINUTES,
    snap: int = SNAP_MINUTES,
) -> list[tuple[int, int]]:
    start = snap_minutes(work_start_min, snap)
    end = snap_minutes(work_end_min, snap)
    if end <= start:
        return []
    return [(a, b) for a, b in subtract_intervals([(start, end)], list(occupied or [])) if b - a >= min_minutes]


def subtract_intervals(
    bases: list[tuple[int, int]],
    cuts: list[tuple[int, int]],
) -> list[tuple[int, int]]:
    remaining = list(bases)
    for c0, c1 in cuts:
        nxt: list[tuple[int, int]] = []
        for a0, a1 in remaining:
            if c1 <= a0 or c0 >= a1:
                nxt.append((a0, a1))
                continue
            if a0 < c0:
                nxt.append((a0, min(a1, c0)))
            if a1 > c1:
                nxt.append((max(a0, c1), a1))
        remaining = [(s, e) for s, e in nxt if e - s >= 5]
    remaining.sort()
    return remaining


@dataclass(frozen=True)
class EngineTask:
    id: str
    title: str
    category_slug: str
    priority: str
    priority_score: int
    estimated_minutes: int
    due_date: date | None
    deadline: date | None
    delay_count: int
    waiting_days: int
    status: str


@dataclass(frozen=True)
class EngineRoutine:
    id: str
    name: str
    category_slug: str
    start_min: int
    end_min: int
    protected: bool
    flexible: bool
    priority: int


@dataclass(frozen=True)
class EngineEvent:
    id: str
    title: str
    start_min: int
    end_min: int


@dataclass
class PlannedBlock:
    start_min: int
    end_min: int
    block_type: str
    title: str
    category_slug: str | None = None
    task_id: str | None = None
    calendar_event_id: str | None = None
    routine_block_id: str | None = None
    locked: bool = False
    generated: bool = True


@dataclass
class Displacement:
    task_id: str
    previous_date: date | None
    previous_start_min: int | None
    new_date: date | None
    new_start_min: int | None
    reason: str
    source: str


@dataclass
class EngineConfig:
    work_start_min: int = 8 * 60 + 30
    work_end_min: int = 16 * 60 + 30
    category_targets: dict[str, float] = field(default_factory=dict)
    weights: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    adaptive_durations: dict[str, int] = field(default_factory=dict)


def effective_duration(task: EngineTask, cfg: EngineConfig) -> int:
    hist = cfg.adaptive_durations.get(task.id) or cfg.adaptive_durations.get(task.category_slug)
    est = max(5, int(task.estimated_minutes or 30))
    if not hist:
        return est
    return max(5, round(0.7 * est + 0.3 * hist))


def score_task(
    task: EngineTask,
    *,
    today: date,
    slot_category: str | None,
    slot_minutes: int,
    allocated_share: dict[str, float],
    cfg: EngineConfig,
) -> float:
    w = {**DEFAULT_WEIGHTS, **(cfg.weights or {})}
    pri = (task.priority or "medium").lower()
    score = float(w.get(pri, w["medium"]))
    score += max(0, int(task.priority_score or 0))
    due = task.deadline or task.due_date
    if due:
        if due < today:
            score += w["overdue"] + (today - due).days * w["overdue_per_day"]
        elif due == today:
            score += w["due_today"]
    score += min(w["aging_cap"], max(0, task.waiting_days) * w["aging_per_day"])
    score += max(0, task.delay_count) * w["delay_count"]
    dur = effective_duration(task, cfg)
    if dur <= slot_minutes:
        score += w["fits"]
    else:
        score -= 400
    if slot_category and task.category_slug == slot_category:
        score += w["category_match"]
    target = float((cfg.category_targets or {}).get(task.category_slug, 0) or 0)
    have = float(allocated_share.get(task.category_slug, 0) or 0)
    if target > 0 and have < target:
        score += w["under_target"] * (target - have)
    return score


def _allocated_share(blocks: Iterable[PlannedBlock], work_span: int) -> dict[str, float]:
    if work_span <= 0:
        return {}
    totals: dict[str, int] = {}
    for b in blocks:
        if not b.category_slug:
            continue
        totals[b.category_slug] = totals.get(b.category_slug, 0) + max(0, b.end_min - b.start_min)
    return {k: v / work_span for k, v in totals.items()}


def _pick_task(
    tasks: list[EngineTask],
    used: set[str],
    *,
    today: date,
    slot_category: str | None,
    slot_minutes: int,
    require_category: bool,
    allocated: dict[str, float],
    cfg: EngineConfig,
) -> EngineTask | None:
    eligible: list[EngineTask] = []
    for t in tasks:
        if t.id in used or t.status in {"complete", "cancelled", "blocked"}:
            continue
        if require_category and slot_category and t.category_slug != slot_category:
            continue
        if effective_duration(t, cfg) > slot_minutes:
            continue
        eligible.append(t)
    if not eligible:
        return None
    eligible.sort(
        key=lambda t: (
            -score_task(
                t,
                today=today,
                slot_category=slot_category,
                slot_minutes=slot_minutes,
                allocated_share=allocated,
                cfg=cfg,
            ),
            -PRIORITY_RANK.get((t.priority or "medium").lower(), 0),
            t.title.lower(),
        )
    )
    return eligible[0]


def _fill_slot(
    start: int,
    end: int,
    *,
    block_type: str,
    category: str | None,
    routine_id: str | None,
    routine_name: str | None,
    require_category: bool,
    locked: bool,
    tasks: list[EngineTask],
    used: set[str],
    today: date,
    planned: list[PlannedBlock],
    cfg: EngineConfig,
    work_span: int,
) -> None:
    cursor = start
    while cursor + 5 <= end:
        allocated = _allocated_share(planned, work_span)
        remaining = end - cursor
        picked = _pick_task(
            tasks,
            used,
            today=today,
            slot_category=category,
            slot_minutes=remaining,
            require_category=require_category,
            allocated=allocated,
            cfg=cfg,
        )
        if not picked:
            if cursor < end:
                planned.append(
                    PlannedBlock(
                        start_min=cursor,
                        end_min=end,
                        block_type="open" if block_type != "routine" else "routine",
                        title=routine_name or "Open",
                        category_slug=category,
                        routine_block_id=routine_id,
                        locked=locked,
                    )
                )
            break
        dur = min(remaining, effective_duration(picked, cfg))
        used.add(picked.id)
        planned.append(
            PlannedBlock(
                start_min=cursor,
                end_min=cursor + dur,
                block_type="task",
                title=picked.title,
                category_slug=picked.category_slug,
                task_id=picked.id,
                routine_block_id=routine_id,
                locked=locked,
            )
        )
        cursor += dur


def build_day(
    *,
    today: date,
    tasks: list[EngineTask],
    routines: list[EngineRoutine],
    events: list[EngineEvent],
    keep: list[PlannedBlock] | None = None,
    cfg: EngineConfig | None = None,
    previous: list[PlannedBlock] | None = None,
) -> tuple[list[PlannedBlock], list[Displacement]]:
    """Build a full-day plan. ``keep`` blocks (in-progress/locked) are preserved."""
    cfg = cfg or EngineConfig()
    work_span = max(1, cfg.work_end_min - cfg.work_start_min)
    kept = list(keep or [])
    planned: list[PlannedBlock] = []
    used: set[str] = {b.task_id for b in kept if b.task_id}

    busy: list[tuple[int, int]] = []
    for k in kept:
        planned.append(k)
        busy.append((k.start_min, k.end_min))

    for ev in sorted(events, key=lambda e: (e.start_min, e.end_min)):
        s = max(cfg.work_start_min, ev.start_min)
        e = min(cfg.work_end_min, ev.end_min)
        if e - s < 5:
            continue
        planned.append(
            PlannedBlock(
                start_min=s,
                end_min=e,
                block_type="meeting",
                title=ev.title,
                category_slug="meetings",
                calendar_event_id=ev.id,
                locked=True,
            )
        )
        busy.append((s, e))
        used.add(f"event:{ev.id}")

    meeting_cuts = [(b.start_min, b.end_min) for b in planned if b.block_type == "meeting"]
    keep_cuts = [(b.start_min, b.end_min) for b in kept]

    for rt in sorted(routines, key=lambda r: (r.start_min, r.end_min)):
        pieces = subtract_intervals([(rt.start_min, rt.end_min)], meeting_cuts + keep_cuts)
        for s, e in pieces:
            _fill_slot(
                s,
                e,
                block_type="routine",
                category=rt.category_slug,
                routine_id=rt.id,
                routine_name=rt.name,
                require_category=bool(rt.protected and not rt.flexible),
                locked=rt.protected and not rt.flexible,
                tasks=tasks,
                used=used,
                today=today,
                planned=planned,
                cfg=cfg,
                work_span=work_span,
            )

    occupied = [(b.start_min, b.end_min) for b in planned]
    free = subtract_intervals([(cfg.work_start_min, cfg.work_end_min)], occupied)
    for s, e in free:
        _fill_slot(
            s,
            e,
            block_type="open",
            category=None,
            routine_id=None,
            routine_name=None,
            require_category=False,
            locked=False,
            tasks=tasks,
            used=used,
            today=today,
            planned=planned,
            cfg=cfg,
            work_span=work_span,
        )

    planned.sort(key=lambda b: (b.start_min, b.end_min, b.title))

    prev_by_task: dict[str, PlannedBlock] = {}
    for b in previous or []:
        if b.task_id:
            prev_by_task[b.task_id] = b
    new_by_task = {b.task_id: b for b in planned if b.task_id}

    displacements: list[Displacement] = []
    for tid, old in prev_by_task.items():
        new = new_by_task.get(tid)
        if new is None:
            displacements.append(
                Displacement(
                    task_id=tid,
                    previous_date=today,
                    previous_start_min=old.start_min,
                    new_date=weekday_offset(today),
                    new_start_min=None,
                    reason="insufficient_time",
                    source="scheduler",
                )
            )
            continue
        if new.start_min <= old.start_min:
            continue
        reason = "higher_priority"
        for ev in events:
            if ev.start_min < old.end_min and ev.end_min > old.start_min:
                reason = "meeting"
                break
        displacements.append(
            Displacement(
                task_id=tid,
                previous_date=today,
                previous_start_min=old.start_min,
                new_date=today,
                new_start_min=new.start_min,
                reason=reason,
                source="scheduler",
            )
        )

    return planned, displacements


def current_and_next(
    blocks: list[PlannedBlock],
    now_min: int,
) -> tuple[PlannedBlock | None, PlannedBlock | None]:
    current = None
    nxt = None
    ordered = sorted(blocks, key=lambda b: b.start_min)
    for b in ordered:
        if b.start_min <= now_min < b.end_min:
            current = b
        elif b.start_min >= now_min and nxt is None:
            nxt = b
    if current is None:
        for b in ordered:
            if b.end_min > now_min:
                nxt = nxt or b
                break
    return current, nxt


def at_risk_tasks(tasks: list[EngineTask], today: date, scheduled_ids: set[str]) -> list[EngineTask]:
    out: list[EngineTask] = []
    for t in tasks:
        if t.status in {"complete", "cancelled"}:
            continue
        due = t.deadline or t.due_date
        overdue = bool(due and due < today)
        due_today_unscheduled = bool(due == today and t.id not in scheduled_ids)
        repeated = t.delay_count >= 2 and t.id not in scheduled_ids
        if overdue or due_today_unscheduled or repeated:
            out.append(t)
    out.sort(key=lambda t: (0 if (t.deadline or t.due_date or today) < today else 1, t.title.lower()))
    return out


def weekday_offset(d: date, days: int = 1) -> date:
    nxt = d + timedelta(days=days)
    while nxt.weekday() >= 5:
        nxt += timedelta(days=1)
    return nxt
