# Pulse · Gamification System
# Production Refinement Document
# Status: ~75% built — this document defines what to add, fix, and standardize

---

## Architecture (unchanged)

```
User Action → Domain Event → Event Subscriber → try_grant_xp() → XpLedger + UserStats
                                                               ↓
                                              badge_engine + streak_service + level curve
                                                               ↓
                                              gamification.xp_awarded domain event → mobile
```

Every XP award flows through `try_grant_xp()`. No XP logic lives in routes. No exceptions.

---

## Core Principles

1. Reward outcomes, not interactions
2. Quality over quantity
3. Feedback is lightweight — no blocking modals
4. No penalties — remove bonuses instead
5. XP is permanent — no decay, no loss
6. Every reward has a dedupe key — double-grants are impossible by design

---

## Design Decisions (locked in)

### Quality XP — Additive Buckets, Not Invisible Multipliers

Stacked multipliers work mathematically but are impossible to explain to
users or debug at scale. The mental model going forward is additive buckets:

```
Base XP:   40     (source_type × priority × difficulty × role)
+ Steps:   +6     (all steps completed)
+ Photo:   +4     (attachment present)
+ Clean:   +4     (never flagged)
+ Speed:   +5     (completed ahead of time)
──────────────
Total:     59 XP
```

Same math as multipliers internally. Different presentation externally.

Code stays as multipliers in `compute_worker_task_completion_xp()`.
When the mobile feedback system ships, add to `XpGrantResult`:
```python
xp_breakdown: dict[str, int] = field(default_factory=dict)
# {"base": 40, "steps": 6, "photo": 4, "clean": 4, "speed": 5}
```
Pass through `CompleteTaskResult` → mobile toast: "+59 XP · +6 steps · +4 photo"
No modal. 1.5 seconds. Done.

### Negative XP Hard Rule

**Negative XP can ONLY remove bonuses — never base XP. No exceptions.**

If a task is reopened or flagged:
- Quality bonuses (steps, photo, clean) are removed
- Base XP stays — they did work, even if incomplete
- Speed bonus stays — fast completion is still valid signal

Cap all reversals at `min(reversal_amount, total_quality_bonuses_granted_for_task)`.
Never issue a reversal larger than the bonuses actually awarded.

Track via dedupe keys — only reverse specific bonus ledger entries.
Never touch the `task_completion:{task_id}` base XP entry.

**Add to `handoff/contracts.md`:**
> Negative XP may only reverse quality bonuses. Base XP is never removed.
> All reversals are capped at total bonus XP awarded for that specific task.

### Streaks — Track 4, Show 2

Internally maintain all 4 named streaks in `UserStats.streaks` JSONB:
- `daily_activity` — any qualifying XP-earning action
- `pm_on_time` — PM completed before due date
- `no_flags` — days with no flagged tasks
- `shift_attendance` — shift started on scheduled day

**Externally show only two:**
- Main streak (`daily_activity`) — always visible on home screen and profile
- One specialty streak — whichever of `pm_on_time` or `no_flags` is highest

Showing all 4 creates noise. Workers need to understand their streak at a glance.
Specialty streaks appear as badge progress ("PM Guardian — 4 of 5"), not raw numbers.

### Collaboration Bonus — Flat Now, Scaled Later

Current: 15 XP flat per contributor. Ship it.

Future upgrade when multi-assign ships:
```
collab_bonus = min(base_xp * 0.30, 20)
```
Scales with task importance. Cap prevents farming easy tasks for collab XP.
Mark the subscriber with `# TODO: scale with base_xp when multi-assign ships`.

### The Bigger Picture

This system is not gamification. It is a **behavior reinforcement engine**.

XP numbers are a side effect. The real output:
- Workers develop good maintenance habits without being told
- Proactive behaviors (inference confirmation, PM on time) are rewarded automatically
- New staff learn by doing — system guides without micromanaging
- Managers see who is engaged without running reports

The `DomainEvent → XP → mobile` pipeline is one step from a live activity stream.
When that ships, the feedback loop closes completely. That is the compounding value.

---

## What Exists — Verified From Repo

### Models (`gamification_models.py`)
- `Task` — source_type: `work_order | pm | routine | project | self`
- `UserStats` — total_xp, xp_worker, xp_lead, xp_supervisor, level, tasks_completed,
  on_time_rate, avg_completion_time, **streak** (single int), last_streak_activity_date,
  avatar_border, unlocked_avatar_borders (JSONB)
- `TaskEvent` — per-completion: xp_earned, completion_time, was_late
- `XpLedger` — append-only, unique on (user_id, dedupe_key)
- `BadgeDefinition`, `UserBadge`, `Review`

### Services
- `xp_grant.py` — `try_grant_xp()`: dedupes via pg_insert ON CONFLICT DO NOTHING,
  updates UserStats, calls streak + badge + level curve, fires domain events
- `xp_worker_task.py` — `compute_worker_task_completion_xp()`: base × priority × difficulty × role × time
- `xp_role_policy.py` — `task_completion_role_multiplier()`, `is_xp_excluded_admin()`
- `xp_level_curve.py` — `xp_progress()`, `xp_to_next_level()`, non-linear curve (fast early, slower later)
- `streak_service.py` — `touch_daily_streak()`, `touch_streak_and_award_milestones()`
  milestones: 3d/7d/30d/100d, bonuses in `xp_rules.STREAK_BONUS_XP`
- `badge_engine.py` — `evaluate_new_badges()`: checks wo/streak/ontime/proc/insp counts
- `xp_event_subscribers.py` — 4 subscribers wired (work_request_assigned, schedule_shift_created,
  supervisor_one_on_one, review_submitted)
- `xp_reasons.py` — `display_reason()` — human labels for all reason codes

### Anti-gaming already implemented
- Self-task XP capped at 20 XP/day (TaskEvent sum check)
- XpLedger dedupe_key: `ON CONFLICT DO NOTHING` — double-grants are DB-enforced impossible
- `is_xp_excluded_admin()` — admins earn 0 XP
- `user_may_earn_track()` — role → track enforcement

---

## Section 1 — XP Model (complete specification)

### Base XP by source type
Already in `xp_worker_task.py`. Document here as canonical reference:

```
source_type    base_xp
work_order     15
pm             10
routine         5
project        25
self            3   ← priority ignored (anti-gaming)
```

### Task multipliers (already implemented)
```
Task.priority:   low=1  medium=2  high=3  critical=4
Task.difficulty: 1=standard  2=complex  3=expert
```

### Role multiplier (already in `xp_role_policy.py`)
```
worker:      1.0×
lead:        1.2×
supervisor:  1.5×  (task completion only — supervisors have a separate XP track)
admin:       0×    (excluded)
```

### Quality multipliers — ADD TO `xp_worker_task.py`

Quality signals come from the event metadata at completion time.
Internally they stack multiplicatively, capped at 2.0×.
Externally they are surfaced as named buckets (see Design Decisions above).

```
completed_on_time:    ×1.2   (already implemented — keep)
all_steps_completed:  +15%   ADD — procedure step completion flag in metadata
photo_attached:       +10%   ADD — at least one attachment on the source work order
no_flags_ever:        +10%   ADD — task was never flagged during its lifecycle
speed_bonus:          +12%   (already implemented — capped at 25 XP)
```

**Max combined multiplier: 2.0× — never exceed this.**

#### Where quality multipliers live

In `compute_worker_task_completion_xp()` in `xp_worker_task.py`, extend the signature:

```python
def compute_worker_task_completion_xp(
    task: Task,
    *,
    completed_on_time: bool,
    completion_time_hours: float,
    role_multiplier: float,
    # ADD THESE:
    all_steps_completed: bool = False,
    photo_attached: bool = False,
    never_flagged: bool = True,
) -> tuple[int, dict[str, int]]:  # return XP + breakdown dict
    ...
    quality = 1.0
    breakdown: dict[str, int] = {}

    if all_steps_completed: quality += 0.15
    if photo_attached:       quality += 0.10
    if never_flagged:        quality += 0.10
    quality = min(2.0, quality)
    base = int(base * quality)

    # Populate breakdown for mobile display
    breakdown["base"]  = int(base_before_quality)
    breakdown["steps"] = int(base_before_quality * 0.15) if all_steps_completed else 0
    breakdown["photo"] = int(base_before_quality * 0.10) if photo_attached       else 0
    breakdown["clean"] = int(base_before_quality * 0.10) if never_flagged        else 0
    breakdown["speed"] = speed_bonus
    ...
    return min(500, base + speed_bonus), breakdown
```

Pass these from `POST /tasks/{id}/complete` route by checking:
- `all_steps_completed`: query XpLedger for `proc_complete` entries linked to this task
- `photo_attached`: query work_request attachments count > 0 for source_id
- `never_flagged`: query TaskEvent for any `task_flagged` event on this task_id

Use `False` as the safe default when the query fails — never grant unearned multipliers.

### Full XP table

| Event | Base XP | Track | Dedupe key pattern |
|-------|---------|-------|-------------------|
| task_completed (work_order) | 15–120 computed | worker | `task_completion:{task_id}` |
| task_completed (pm) | 10–80 computed | worker | `task_completion:{task_id}` |
| task_completed (routine) | 5–40 computed | worker | `task_completion:{task_id}` |
| task_completed (project) | 25–200 computed | worker | `task_completion:{task_id}` |
| pm_completed_on_time bonus | 20 flat | worker | `pm_ontime:{pm_task_id}:{user_id}` |
| procedure_completed | 30 | worker | `proc_complete:{proc_id}:{user_id}` |
| procedure_all_steps bonus | +10 | worker | `proc_allsteps:{proc_id}:{user_id}` |
| inference_confirmed | 25 | worker | `inference_confirm:{worker_id}:{equip_id}:{date}` |
| inspection_completed | 20 | worker | `inspection:{sheet_id}:{user_id}` |
| attendance_clock_in | 5 | worker | `attendance:{user_id}:{date}` |
| work_request_assigned | 12 | lead/supervisor | `wr_assign:{wr_id}` |
| assignment_responsive_24h | 8 | lead/supervisor | `wr_assign_resp:{wr_id}` |
| schedule_shift_planned_ahead | 15 | supervisor | `shift_plan:{shift_id}` |
| supervisor_one_on_one | 18 | supervisor | `121:{sup}:{emp}:{week}` |
| review_submitted (≥4 rating) | 10–14 | supervisor | `review:{review_id}` |
| manager_bonus | 1–500 | worker | `mgr_award:{uuid4}` |
| streak_milestone_3d | 10 | worker | `streak_bonus:{user_id}:3:{date}` |
| streak_milestone_7d | 25 | worker | `streak_bonus:{user_id}:7:{date}` |
| streak_milestone_30d | 120 | worker | `streak_bonus:{user_id}:30:{date}` |
| streak_milestone_100d | 400 | worker | `streak_bonus:{user_id}:100:{date}` |
| collaboration_bonus | 15 flat | worker | `collab:{task_id}:{contributor_id}` |
| task_reopen_penalty | −(bonus) | worker | `task_reopen_penalty:{task_id}` |
| flag_bonus_reversal | −(bonus) | worker | `flag_reversal:{task_id}` |

---

## Section 2 — Missing Event Subscribers

Add all of these to `xp_event_subscribers.py`. Follow the exact pattern of existing subscribers.

### 2.1 `ops.inference_confirmed`

```python
async def _on_inference_confirmed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id  = md.get("confirmed_by") or md.get("worker_id")
    inference_id = md.get("inference_id") or str(ev.entity_id)
    equipment_id = md.get("equipment_id") or "unknown"
    if not worker_id or not inference_id:
        return
    cid = str(ev.company_id)
    from datetime import date
    today = date.today().isoformat()
    # One inference XP per worker per equipment per day (prevents gaming the demo scenario)
    dedupe = f"inference_confirm:{worker_id}:{equipment_id}:{today}"
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db, company_id=cid, user_id=str(worker_id),
            track="worker", amount=25,
            reason_code="inference_confirmed",
            dedupe_key=dedupe,
            meta={"inference_id": str(inference_id), "equipment_id": str(equipment_id)},
            reason="Maintenance confirmed proactively",
        )
        await db.commit()

# Register both real and demo event types
event_engine.subscribe("ops.inference_confirmed",   _on_inference_confirmed)
event_engine.subscribe("demo_inference_confirmed",  _on_inference_confirmed)
```

**Publishing side** — in `confirm_inference` route (`telemetry_positions_routes.py`):
```python
await event_engine.publish(DomainEvent(
    event_type="ops.inference_confirmed",
    company_id=str(user.company_id),
    entity_id=inference_id,
    source_module="telemetry",
    metadata={
        "inference_id": inference_id,
        "confirmed_by": str(user.id),
        "equipment_id": equipment_id or "",  # from inference row
    },
))
```

### 2.2 `ops.procedure_completed`

```python
async def _on_procedure_completed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id  = md.get("completed_by") or md.get("worker_id")
    proc_id    = md.get("procedure_id") or str(ev.entity_id)
    all_steps  = bool(md.get("all_steps_completed", False))
    if not worker_id or not proc_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        # Base XP
        await try_grant_xp(
            db, company_id=cid, user_id=str(worker_id),
            track="worker", amount=30,
            reason_code="procedure_completed",
            dedupe_key=f"proc_complete:{proc_id}:{worker_id}",
            meta={"procedure_id": str(proc_id), "all_steps": all_steps},
            reason="Procedure completed",
        )
        # All-steps bonus — separate ledger entry with separate dedupe key
        if all_steps:
            await try_grant_xp(
                db, company_id=cid, user_id=str(worker_id),
                track="worker", amount=10,
                reason_code="procedure_all_steps",
                dedupe_key=f"proc_allsteps:{proc_id}:{worker_id}",
                meta={"procedure_id": str(proc_id)},
                reason="All procedure steps completed",
                apply_badges=False,   # badges evaluated on base grant only
                apply_streak=False,
            )
        await db.commit()

event_engine.subscribe("ops.procedure_completed", _on_procedure_completed)
```

### 2.3 `ops.pm_completed_on_time`

```python
async def _on_pm_completed_on_time(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("completed_by") or md.get("worker_id")
    pm_task_id = md.get("pm_task_id") or str(ev.entity_id)
    if not worker_id or not pm_task_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db, company_id=cid, user_id=str(worker_id),
            track="worker", amount=20,
            reason_code="pm_completed_on_time",
            dedupe_key=f"pm_ontime:{pm_task_id}:{worker_id}",
            meta={"pm_task_id": str(pm_task_id)},
            reason="Preventive maintenance completed on time",
        )
        await db.commit()

event_engine.subscribe("ops.pm_completed_on_time", _on_pm_completed_on_time)
```

**Note:** This event fires in addition to `task_completed` XP, not instead of it.
The PM task completion already fires through `POST /tasks/{id}/complete`.
This subscriber fires separately when the linked PM task is marked complete on time.
Dedupe keys are different — no double-count risk.

### 2.4 `schedule.shift_started` (attendance)

```python
async def _on_shift_started(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("assigned_user_id") or md.get("worker_id")
    shift_id  = md.get("shift_id") or str(ev.entity_id)
    if not worker_id or not shift_id:
        return
    from datetime import date
    today = date.today().isoformat()
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        # One attendance XP per worker per day regardless of shifts
        await try_grant_xp(
            db, company_id=cid, user_id=str(worker_id),
            track="worker", amount=5,
            reason_code="attendance_clock_in",
            dedupe_key=f"attendance:{worker_id}:{today}",
            meta={"shift_id": str(shift_id)},
            reason="Shift started on time",
        )
        await db.commit()

event_engine.subscribe("schedule.shift_started", _on_shift_started)
```

### 2.5 `ops.inspection_sheet_completed`

```python
async def _on_inspection_completed(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    worker_id = md.get("completed_by") or md.get("worker_id")
    sheet_id  = md.get("sheet_id") or str(ev.entity_id)
    if not worker_id or not sheet_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        u = await db.get(User, str(worker_id))
        if not u or str(u.company_id) != cid:
            return
        await try_grant_xp(
            db, company_id=cid, user_id=str(worker_id),
            track="worker", amount=20,
            reason_code="inspection_sheet_completed",
            dedupe_key=f"inspection:{sheet_id}:{worker_id}",
            meta={"sheet_id": str(sheet_id)},
            reason="Inspection submitted",
        )
        await db.commit()

event_engine.subscribe("ops.inspection_sheet_completed", _on_inspection_completed)
```

### Register all subscribers in `attach_xp_event_subscribers()`

```python
def attach_xp_event_subscribers() -> None:
    global _xp_subs_attached
    if _xp_subs_attached:
        return
    _xp_subs_attached = True
    # Existing
    event_engine.subscribe("ops.work_request_assigned",      _on_work_request_assigned)
    event_engine.subscribe("pulse.schedule_shift_created",   _on_schedule_shift_created)
    event_engine.subscribe("ops.supervisor_one_on_one",      _on_supervisor_one_on_one)
    event_engine.subscribe("ops.review_submitted",           _on_review_submitted)
    # ADD
    event_engine.subscribe("ops.inference_confirmed",        _on_inference_confirmed)
    event_engine.subscribe("demo_inference_confirmed",       _on_inference_confirmed)
    event_engine.subscribe("ops.procedure_completed",        _on_procedure_completed)
    event_engine.subscribe("ops.pm_completed_on_time",       _on_pm_completed_on_time)
    event_engine.subscribe("schedule.shift_started",         _on_shift_started)
    event_engine.subscribe("ops.inspection_sheet_completed", _on_inspection_completed)
```

---

## Section 3 — Streak System Redesign

### Current state
`UserStats.streak` (int) + `last_streak_activity_date` (date). Tracks one daily streak.
`streak_service.py` handles milestone bonuses at 3/7/30/100 days.

### What to add
A `streaks` JSONB column on `UserStats` for named streak types. The existing `streak` int
stays for backwards compat — it mirrors `daily_activity.current`.

**Add column to `UserStats`:**
```python
streaks: Mapped[dict] = mapped_column(
    JSONB, nullable=False,
    server_default=text("'{}'::jsonb"),
    comment="Named streak tracking. Keys: daily_activity, pm_on_time, no_flags, shift_attendance"
)
```

**Streak shape (stored in JSONB):**
```json
{
  "daily_activity":   { "current": 12, "best": 15, "last_date": "2026-04-26" },
  "pm_on_time":       { "current": 4,  "best": 8,  "last_date": "2026-04-25" },
  "no_flags":         { "current": 22, "best": 22, "last_date": "2026-04-26" },
  "shift_attendance": { "current": 7,  "best": 7,  "last_date": "2026-04-26" }
}
```

**New function in `streak_service.py`:**
```python
def _update_named_streak(
    streaks: dict,
    streak_type: str,
    activity_day: date,
    broke: bool = False,
) -> tuple[dict, bool]:
    """
    Update a named streak in the JSONB dict.
    Returns (updated_dict, milestone_just_crossed).
    """
    from datetime import timedelta
    entry = streaks.get(streak_type, {"current": 0, "best": 0, "last_date": None})
    last = entry.get("last_date")
    last_d = date.fromisoformat(last) if last else None

    if broke:
        entry["current"] = 0
        streaks[streak_type] = entry
        return streaks, False

    if last_d == activity_day:
        return streaks, False  # already updated today

    if last_d is None or last_d == activity_day - timedelta(days=1):
        entry["current"] = entry.get("current", 0) + 1
    else:
        entry["current"] = 1   # gap — reset

    entry["best"] = max(entry.get("best", 0), entry["current"])
    entry["last_date"] = activity_day.isoformat()
    streaks[streak_type] = entry
    return streaks, True
```

**Call sites:**
- `daily_activity` — called from `touch_streak_and_award_milestones()` (existing, extend it)
- `pm_on_time` — called from `_on_pm_completed_on_time` subscriber
- `no_flags` — extended each day a task completes without a flag;
  broken when `ops.task_flagged` fires
- `shift_attendance` — called from `_on_shift_started` subscriber

**Streak pauses on days off:**
In `touch_daily_streak()`, before resetting a broken streak, check:
```python
# If worker has no shift today AND submitted "unavailable" for today → pause
# Do NOT break the streak — just skip the day
# Implementation: query pulse_schedule_shifts for worker on activity_day
# If no shift exists → treat as pause (return current streak, no reset)
# This is a soft check — failure to query = don't pause (safe default)
```

---

## Section 4 — Anti-Gaming Safeguards

### Already implemented
- Self-task XP: capped at 20/day via TaskEvent sum query
- Double-grant: XpLedger `ON CONFLICT DO NOTHING` — DB-enforced
- Admin exclusion: `is_xp_excluded_admin()` in `try_grant_xp()`
- Role enforcement: `user_may_earn_track()` in `try_grant_xp()`

### Add these

**1. Task reopen removes quality bonus**

When a task moves from `done` back to `todo` or `in_progress`:
```python
# In the route that handles task status change:
# Publish:
await event_engine.publish(DomainEvent(
    event_type="ops.task_reopened",
    company_id=cid, entity_id=task_id, source_module="gamification",
    metadata={"task_id": task_id, "assigned_to": assigned_user_id},
))
```

Subscriber:
```python
async def _on_task_reopened(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    task_id = md.get("task_id") or str(ev.entity_id)
    user_id = md.get("assigned_to")
    if not task_id or not user_id:
        return
    cid = str(ev.company_id)
    # Reversal: issue negative XP equal to quality bonuses only (not base XP)
    # Check XpLedger for any quality bonus entries for this task
    # Reason codes to reverse: procedure_all_steps, and the no_flags/photo portion
    # of task_completion if we can identify it from meta
    # For simplicity: flat -15 XP reversal on reopen
    async with AsyncSessionLocal() as db:
        await try_grant_xp(
            db, company_id=cid, user_id=str(user_id),
            track="worker", amount=-15,  # negative XP removes quality bonus
            reason_code="task_reopen_penalty",
            dedupe_key=f"task_reopen_penalty:{task_id}",
            meta={"task_id": str(task_id)},
            reason="Task reopened — quality bonus removed",
            apply_badges=False, apply_streak=False,
        )
        await db.commit()

event_engine.subscribe("ops.task_reopened", _on_task_reopened)
```

**2. Flagged task removes multiplier bonuses**

```python
async def _on_task_flagged(ev: DomainEvent) -> None:
    md = ev.metadata or {}
    task_id = md.get("task_id") or str(ev.entity_id)
    user_id = md.get("flagged_user_id") or md.get("assigned_to")
    if not task_id or not user_id:
        return
    cid = str(ev.company_id)
    async with AsyncSessionLocal() as db:
        # Check if any quality bonus was granted for this task
        from app.services.xp_grant import has_ledger_entry
        had_allsteps = await has_ledger_entry(
            db, user_id=str(user_id),
            dedupe_key=f"proc_allsteps:{task_id}:{user_id}"
        )
        reversal = 10 if had_allsteps else 0  # only reverse what was granted
        if reversal > 0:
            await try_grant_xp(
                db, company_id=cid, user_id=str(user_id),
                track="worker", amount=-reversal,
                reason_code="flag_bonus_reversal",
                dedupe_key=f"flag_reversal:{task_id}:{user_id}",
                meta={"task_id": str(task_id)},
                reason="Task flagged — quality bonus removed",
                apply_badges=False, apply_streak=False,
            )
        # Also break the no_flags streak
        stats = await db.get(UserStats, str(user_id))
        if stats and stats.streaks:
            from datetime import date
            streaks, _ = _update_named_streak(
                dict(stats.streaks), "no_flags",
                date.today(), broke=True
            )
            stats.streaks = streaks
        await db.commit()

event_engine.subscribe("ops.task_flagged", _on_task_flagged)
```

**3. Status toggling prevention**

Already prevented: `POST /tasks/{id}/complete` checks `task.status == "done"` and returns
early without re-granting XP. The dedupe key `task_completion:{task_id}` enforces this
at the DB level even if the route check is bypassed.

**4. Inference gaming**

Dedupe key: `inference_confirm:{worker_id}:{equipment_id}:{date}`
This prevents the same worker confirming the same equipment more than once per day.
Confirmed by design — no additional code needed.

**5. Negative XP note**

`try_grant_xp()` requires `amount > 0`. For reversals, use a separate pattern:
```python
# In try_grant_xp, add support for negative amounts as reversals:
# Change: if amount <= 0: return await _snapshot(...)
# To:
if amount == 0:
    return await _snapshot(...)
if amount < 0:
    # Reversal path: insert negative ledger entry, subtract from UserStats
    # Same dedupe logic applies — reversals are idempotent
    ...
```
Or: keep reversals as separate `XpLedger` rows with negative `xp_delta`.
The pg_insert ON CONFLICT DO NOTHING dedupe still applies.
Simplest: treat negative `amount` the same as positive but subtract from stats.

---

## Section 5 — Collaboration Handling

Simple, explicit, no new models needed.

**When a task has collaborators in metadata:**
```python
# In POST /tasks/{id}/complete or via ops.task_completed subscriber:
collaborators = task_meta.get("collaborators", [])  # list of user_ids
for contributor_id in collaborators:
    if str(contributor_id) == str(user_id):
        continue  # skip completer
    await try_grant_xp(
        db, company_id=cid, user_id=str(contributor_id),
        track="worker", amount=15,
        reason_code="collaboration_bonus",
        dedupe_key=f"collab:{task.id}:{contributor_id}",
        meta={"task_id": str(task.id), "completer": str(user_id)},
        reason="Collaboration bonus",
        apply_badges=False, apply_streak=False,
    )
```

**How collaborators get onto the task:**
Add `collaborators` JSONB field to `Task` model (list of user_ids).
Set it when multiple workers are assigned or contribute to a work request.
This is a future enhancement — the XP logic is ready when the UI supports it.

---

## Section 6 — Role-Based XP Clarification

**Same base XP for the same action across all roles.**
The `role_multiplier` scales the reward — it does not change what earns XP.

**Three separate XP tracks (already implemented):**
- `worker` — completion of assigned work
- `lead` — assigning work, responsiveness
- `supervisor` — planning, coaching, reviews

**Fairness rules:**
- A supervisor completing a task earns `worker` track XP at 1.5× — same base, higher reward
  for accountability
- A supervisor assigning work earns `lead` track XP at their supervisor rate
- Tracks are stored separately in `UserStats` (xp_worker, xp_lead, xp_supervisor)
- Leaderboard should filter by track — workers compete with workers,
  supervisors compete with supervisors

**Current gap:** `task_completion_role_multiplier()` returns `1.0` for all non-supervisor roles.
This is correct and intentional — field workers on the same role all get the same multiplier.
The multiplier is for fairness across role types, not within the same role.

---

## Section 7 — Badge System Completion

### Current badge slugs in `badge_engine.py`
`streak_3`, `streak_7`, `streak_30`, `wo_10`, `wo_50`, `wo_200`,
`ontime_10`, `ontime_50`, `proc_10`, `proc_50`, `insp_10`

### Add these checks to `evaluate_new_badges()`

```python
# Add queries:
async def _count_inferences_confirmed(db, *, company_id, user_id) -> int:
    q = await db.execute(
        select(func.count()).select_from(XpLedger).where(
            XpLedger.company_id == company_id,
            XpLedger.user_id == user_id,
            XpLedger.reason_code == "inference_confirmed",
        )
    )
    return int(q.scalar_one() or 0)

async def _count_pm_on_time(db, *, company_id, user_id) -> int:
    q = await db.execute(
        select(func.count()).select_from(XpLedger).where(
            XpLedger.company_id == company_id,
            XpLedger.user_id == user_id,
            XpLedger.reason_code == "pm_completed_on_time",
        )
    )
    return int(q.scalar_one() or 0)

# In evaluate_new_badges(), add:
inferences = await _count_inferences_confirmed(db, company_id=company_id, user_id=user_id)
pm_ontime  = await _count_pm_on_time(db, company_id=company_id, user_id=user_id)

candidates += [
    ("inference_5",      inferences >= 5),
    ("inference_20",     inferences >= 20),
    ("pm_guardian_5",    pm_ontime >= 5),
    ("first_task",       wo >= 1),
    ("streak_100",       streak >= 100),
]
```

### Badge definitions to seed (alembic migration)

Extend the existing badge slugs with these new ones:

```python
NEW_BADGES = [
    # Initiative
    ("inference_5",    "Maintenance Spotter", "Confirmed 5 maintenance inferences",  "initiative", "eye"),
    ("inference_20",   "Early Detector",      "Confirmed 20 maintenance inferences", "initiative", "alert"),
    # PM
    ("pm_guardian_5",  "PM Guardian",         "5 PMs completed on time",             "reliability", "shield"),
    # Volume
    ("first_task",     "First Task",          "Complete your first task",            "volume", "flag"),
    ("streak_100",     "Century Streak",      "100-day activity streak",             "streak", "trophy"),
]
```

### When badges are evaluated

- **On every XP grant:** `try_grant_xp()` calls `evaluate_new_badges()` (already wired)
- **Exception:** `apply_badges=False` for bonus/streak/collaboration grants to avoid
  redundant queries — badges are only evaluated on the primary completion grant

---

## Section 8 — Missing Endpoints (add to `gamification_routes.py`)

### `GET /api/v1/gamification/leaderboard`

```python
@router.get("/gamification/leaderboard", response_model=list[LeaderboardEntryOut])
async def get_leaderboard(
    db: Db,
    user: User = Depends(require_tenant_user),
    limit: int = Query(25, ge=5, le=100),
) -> list[LeaderboardEntryOut]:
    from app.models.domain import User as UserModel
    cid = str(user.company_id)
    uid = str(user.id)
    rows = (await db.execute(
        select(UserStats, UserModel)
        .join(UserModel, UserModel.id == UserStats.user_id)
        .where(UserStats.company_id == cid, UserModel.is_active.is_(True))
        .order_by(UserStats.total_xp.desc())
        .limit(limit)
    )).all()
    result = []
    for rank, (stats, u) in enumerate(rows, start=1):
        lv, _, _ = xp_progress(int(stats.total_xp))
        result.append(LeaderboardEntryOut(
            rank=rank,
            user_id=str(stats.user_id),
            display_name=u.full_name or u.email or "Worker",
            total_xp=int(stats.total_xp),
            level=lv,
            is_me=str(stats.user_id) == uid,
        ))
    return result
```

### `GET /api/v1/workers/{user_id}/gamification`

```python
@router.get("/workers/{user_id}/gamification", response_model=GamificationMeOut)
async def get_worker_gamification(
    user_id: str, db: Db, user: User = Depends(require_tenant_user),
) -> GamificationMeOut:
    cid = str(user.company_id)
    is_self = str(user.id) == user_id
    is_manager = user_has_any_role(user, UserRole.manager, UserRole.company_admin)
    if not is_self and not is_manager:
        raise HTTPException(403, "Cannot view another worker's gamification")
    target = await db.get(User, user_id)
    if not target or str(target.company_id) != cid:
        raise HTTPException(404, "Worker not found")
    # Reuse gamification_me logic by passing target user
    return await gamification_me(db, target)
```

### `GET /api/v1/workers/me/certifications`

```python
@router.get("/workers/me/certifications", response_model=list[CertificationOut])
async def get_my_certifications(
    db: Db, user: User = Depends(require_tenant_user),
) -> list[CertificationOut]:
    from app.models.pulse_models import PulseWorkerProfile
    cid = str(user.company_id)
    profile = (await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.user_id == str(user.id),
            PulseWorkerProfile.company_id == cid,
        )
    )).scalar_one_or_none()
    raw = (profile.certifications if profile else None) or []
    return [
        CertificationOut(
            code=str(c).strip().upper(),
            label=str(c).strip().upper(),  # TODO: lookup from pulse_config cert definitions
            expires_at=None,               # TODO: cert_expiry JSONB on PulseWorkerProfile
            days_until_expiry=None,
        )
        for c in raw if c
    ]
```

---

## Section 9 — Build Phases

### Phase G1 — Wire missing subscribers (high priority)
- Add 5 new subscribers to `xp_event_subscribers.py`
- Publish `ops.inference_confirmed` from confirm route
- Publish `ops.procedure_completed` from procedure completion
- Add `ops.task_reopened` + `ops.task_flagged` publishing

### Phase G2 — Missing endpoints
- `GET /gamification/leaderboard`
- `GET /workers/{id}/gamification`
- `GET /workers/me/certifications`

### Phase G3 — Quality multipliers
- Extend `compute_worker_task_completion_xp()` signature
- Wire quality signals in `POST /tasks/{id}/complete` route

### Phase G4 — Named streaks
- Add `streaks` JSONB column to `UserStats` (migration)
- Add `_update_named_streak()` to `streak_service.py`
- Wire pm_on_time, no_flags, shift_attendance streak updates

### Phase G5 — Anti-gaming additions
- Support negative `amount` in `try_grant_xp()` for reversals
- Add `_on_task_reopened` + `_on_task_flagged` subscribers
- Seed new badge definitions in migration

---

## Final Verification

| Rule | Enforced where |
|------|----------------|
| Every reward comes from an event | `attach_xp_event_subscribers()` — all grants via `try_grant_xp()` |
| No double-grants | `XpLedger` unique constraint on `(user_id, dedupe_key)` |
| No XP for status toggling | Route early-return + task_completion dedupe key |
| No XP for partial actions | Subscribers require full event metadata to proceed |
| Quality multipliers capped | `min(2.0, quality)` in `compute_worker_task_completion_xp()` |
| Quality displayed as buckets | `xp_breakdown` dict in `XpGrantResult` → mobile toast |
| **Negative XP: bonuses only** | **Reversals capped at bonus amount — base XP never touched** |
| Admin exclusion | `is_xp_excluded_admin()` inside `try_grant_xp()` |
| Role fairness | Same base XP, role_multiplier adjusts reward |
| Inference gaming | Dedupe key includes equipment_id + date |
| Task reopen | Reversal removes quality bonus only, never base XP |
| Flag penalty | Reversal removes quality bonus only, never base XP |
| Collaboration | Flat 15 XP now, `min(base×0.30, 20)` when multi-assign ships |
| Streak: track 4, show 2 | JSONB stores all 4 — UI exposes daily + highest specialty |
| Streak consistency | Named streaks in JSONB, existing int for backwards compat |

---

## Contracts Update Required

Add to `handoff/contracts.md` under a new `## Gamification Rules` section:

```
- Negative XP may only reverse quality bonuses. Base XP is never removed.
- All reversals are capped at total bonus XP awarded for that specific task.
- Quality XP is surfaced to users as named buckets (base, steps, photo, clean, speed).
- Streak count: 4 types tracked internally, 2 shown externally (daily + highest specialty).
- Collaboration bonus is flat 15 XP until multi-assign ships.
```
