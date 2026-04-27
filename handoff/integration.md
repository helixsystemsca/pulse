# Schedule Phase 3 — Builder Improvements
# handoffs/integration.md

## CURSOR PROMPT
"Read handoff/integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
Run cd frontend && npm run build before committing.
Commit with the message provided at the end."

---

## WHAT'S ALREADY DONE (skip these)
- Phase 3A: Drag highlight tones are fully wired — buildWorkerDragHighlightMap
  → workerHighlightByDate → ScheduleCalendarGrid → drag-highlight-classes.ts.
  DO NOT touch this.
- Phases 1 + 2: shift_definitions, periods, availability_submissions,
  acknowledgements all exist in DB and API.

---

## STEP 1 — Update pulse-bridge.ts to map shift_code and shift_definition_id

=== MODIFY: frontend/lib/schedule/pulse-bridge.ts ===

ACTION: add shift_code and shift_definition_id to PulseShiftApi and mapShift

FIND PulseShiftApi type and add two fields:
```ts
shift_code?: string | null;
shift_definition_id?: string | null;
```

FIND the function that maps PulseShiftApi → Shift (look for mapShift or similar).
Add to the returned Shift object:
```ts
shiftCode: raw.shift_code ?? undefined,
shiftDefinitionId: raw.shift_definition_id ?? undefined,
```

Also add these two optional fields to the Shift interface in
frontend/lib/schedule/types.ts:
```ts
shiftCode?: string;
shiftDefinitionId?: string;
```

---

## STEP 2 — Wire shift_code display into compact cell chips

=== MODIFY: frontend/components/schedule/ScheduleCompactCellRows.tsx ===

ACTION: show shift code badge on shift chips when available

Find where worker name / shift time is rendered inside each shift chip.
When `shift.shiftCode` is present, render a small badge before or after
the worker name:

```tsx
{shift.shiftCode && (
  <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-bold uppercase tracking-wide bg-ds-accent/15 text-ds-accent mr-1">
    {shift.shiftCode}
  </span>
)}
```

Do not add this badge to project_task shifts (check shift.shiftKind !== "project_task").

---

## STEP 3 — Cert filtering in worker panel during active shift drag

=== MODIFY: frontend/components/schedule/ScheduleWorkerPanel.tsx ===

ACTION: grey out workers missing certs when dragging a shift that has cert requirements

Find where worker rows/cards are rendered. The component already has
`dragSession` available (check props). Add:

```tsx
// Derive required certs from the dragged shift when kind === "shift"
const activeCertRequirements: string[] = useMemo(() => {
  if (!dragSession || dragSession.kind !== "shift") return [];
  const s = shifts.find(x => x.id === dragSession.shiftId);
  return s?.required_certifications ?? [];
}, [dragSession, shifts]);

function workerMeetsCerts(worker: Worker, required: string[]): boolean {
  if (!required.length) return true;
  const wc = new Set(worker.certifications ?? []);
  return required.every(c => wc.has(c));
}
```

Apply to each worker card className:
```tsx
const eligible = workerMeetsCerts(worker, activeCertRequirements);
// Add to className: !eligible ? "opacity-40 pointer-events-none" : ""
// Add title: !eligible ? `Missing cert: ${missingCerts.join(", ")}` : undefined
```

If dragSession is not already in ScheduleWorkerPanel props, add it:
```tsx
dragSession: ScheduleDragSession | null;
shifts: Shift[];
```
And pass it from ScheduleApp where ScheduleWorkerPanel is rendered.

---

## STEP 4 — Draft engine (backend)

=== FILE: backend/app/modules/pulse/draft_engine.py ===

```python
"""
Schedule draft auto-populate engine.
Scores and assigns auxiliary workers to open shift slots.
Reads availability in both v1 and v2 formats (matches service.py behavior).
Called by POST /api/v1/pulse/schedule/draft.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import PulseScheduleShift, PulseWorkerProfile

log = logging.getLogger("pulse.schedule.draft")

WEEKDAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]


@dataclass
class DraftSlot:
    date: date
    start_min: int          # minutes from midnight
    end_min: int
    shift_type: str
    shift_definition_id: str | None = None
    shift_code: str | None = None
    required_certs: list[str] = field(default_factory=list)
    facility_id: str | None = None


@dataclass
class DraftAssignment:
    slot: DraftSlot
    user_id: str
    user_name: str
    score: float
    warnings: list[str] = field(default_factory=list)


@dataclass
class DraftConflict:
    slot: DraftSlot
    reason: str


@dataclass
class DraftResult:
    assignments: list[DraftAssignment]
    conflicts: list[DraftConflict]
    total_slots: int


def _parse_availability_v2(av: dict[str, Any], weekday: int) -> tuple[int, int] | None:
    """v2: {monday: [{start: 480, end: 1020}], ...}"""
    key = WEEKDAY_KEYS[weekday]
    windows = av.get(key)
    if not windows or not isinstance(windows, list):
        return None
    for w in windows:
        if isinstance(w, dict):
            s = w.get("start")
            e = w.get("end")
            if s is not None and e is not None:
                return (int(s), int(e))
    return None


def _parse_availability_v1(av: dict[str, Any], weekday: int) -> tuple[int, int] | None:
    """v1: {windows: [{weekday: 0, start_min: 480, end_min: 1020}]}"""
    windows = av.get("windows")
    if not windows or not isinstance(windows, list):
        return None
    for w in windows:
        if not isinstance(w, dict):
            continue
        if int(w.get("weekday", -1)) == weekday:
            sm = w.get("start_min")
            em = w.get("end_min")
            if sm is not None and em is not None:
                return (int(sm), int(em))
    return None


def _worker_available_for_slot(av: dict[str, Any], slot: DraftSlot) -> bool:
    weekday = slot.date.weekday()  # 0=Monday
    window = _parse_availability_v2(av, weekday) or _parse_availability_v1(av, weekday)
    if not window:
        return False
    sm, em = window
    # Worker window must cover at least the start of the slot
    return sm <= slot.start_min < em


def _worker_has_certs(worker_certs: list[str], required: list[str]) -> bool:
    if not required:
        return True
    wc = set(c.lower() for c in worker_certs)
    return all(c.lower() in wc for c in required)


def _period_shift_hours(
    all_shifts: list[PulseScheduleShift],
    user_id: str,
    period_start: date,
    period_end: date,
) -> float:
    total = 0.0
    for s in all_shifts:
        if str(s.assigned_user_id) != user_id:
            continue
        if not (period_start <= s.starts_at.date() <= period_end):
            continue
        total += (s.ends_at - s.starts_at).total_seconds() / 3600
    return total


def _slot_hours(slot: DraftSlot) -> float:
    mins = slot.end_min - slot.start_min
    if mins < 0:
        mins += 24 * 60
    return mins / 60


def _already_assigned(
    assignments: list[DraftAssignment],
    user_id: str,
    slot: DraftSlot,
) -> bool:
    for a in assignments:
        if a.user_id == user_id and a.slot.date == slot.date:
            return True
    return False


def _score_worker(
    profile: PulseWorkerProfile,
    slot: DraftSlot,
    all_shifts: list[PulseScheduleShift],
    period_start: date,
    period_end: date,
    max_hours: float,
    fairness_enabled: bool,
) -> tuple[float, list[str]]:
    """Score 0–100+. Returns -1 if hard-blocked."""
    score = 100.0
    warnings: list[str] = []
    av = profile.availability or {}

    if not _worker_available_for_slot(av, slot):
        return -1.0, ["Not available"]

    period_hours = _period_shift_hours(all_shifts, str(profile.user_id), period_start, period_end)
    slot_h = _slot_hours(slot)

    if period_hours + slot_h > max_hours:
        warnings.append(f"Would exceed {max_hours}h period limit")
        score -= 30

    if fairness_enabled:
        # Fewer shifts this period = higher score
        period_count = sum(
            1 for s in all_shifts
            if str(s.assigned_user_id) == str(profile.user_id)
            and period_start <= s.starts_at.date() <= period_end
        )
        score -= period_count * 5

    scheduling = profile.scheduling or {}
    if scheduling.get("employment_type") == "full_time":
        score += 10

    return score, warnings


async def build_draft(
    db: AsyncSession,
    company_id: str,
    slots: list[DraftSlot],
    period_start: date,
    period_end: date,
    max_hours_per_worker: float = 160,
    fairness_enabled: bool = True,
) -> DraftResult:
    q = await db.execute(
        select(PulseWorkerProfile, User)
        .join(User, User.id == PulseWorkerProfile.user_id)
        .where(
            PulseWorkerProfile.company_id == company_id,
            User.is_active.is_(True),
        )
    )
    profile_rows = q.all()

    period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    period_end_dt   = datetime.combine(period_end,   datetime.max.time(), tzinfo=timezone.utc)

    existing_q = await db.execute(
        select(PulseScheduleShift).where(
            PulseScheduleShift.company_id == company_id,
            PulseScheduleShift.starts_at >= period_start_dt,
            PulseScheduleShift.ends_at   <= period_end_dt,
        )
    )
    existing_shifts = list(existing_q.scalars().all())

    assignments: list[DraftAssignment] = []
    conflicts:   list[DraftConflict]   = []

    for slot in slots:
        slot_dt = datetime.combine(
            slot.date,
            datetime.min.time().replace(hour=slot.start_min // 60, minute=slot.start_min % 60),
            tzinfo=timezone.utc,
        )
        # Skip if full-time shift already covers this slot
        already_filled = any(
            abs((s.starts_at - slot_dt).total_seconds()) < 300
            for s in existing_shifts
        )
        if already_filled:
            continue

        best_score = -1.0
        best_profile: PulseWorkerProfile | None = None
        best_user: User | None = None
        best_warnings: list[str] = []

        for profile, user in profile_rows:
            certs = profile.certifications or []
            if not _worker_has_certs(certs, slot.required_certs):
                continue
            if _already_assigned(assignments, str(profile.user_id), slot):
                continue

            score, warnings = _score_worker(
                profile, slot, existing_shifts,
                period_start, period_end,
                max_hours_per_worker, fairness_enabled,
            )

            if score > best_score:
                best_score    = score
                best_profile  = profile
                best_user     = user
                best_warnings = warnings

        if best_profile and best_user and best_score >= 0:
            assignments.append(DraftAssignment(
                slot=slot,
                user_id=str(best_profile.user_id),
                user_name=best_user.full_name or best_user.email,
                score=best_score,
                warnings=best_warnings,
            ))
        else:
            reason = "No eligible worker available"
            if slot.required_certs:
                reason = f"No worker with required certs: {', '.join(slot.required_certs)}"
            conflicts.append(DraftConflict(slot=slot, reason=reason))

    log.info(
        "draft company=%s slots=%d assigned=%d conflicts=%d",
        company_id[:8], len(slots), len(assignments), len(conflicts),
    )
    return DraftResult(
        assignments=assignments,
        conflicts=conflicts,
        total_slots=len(slots),
    )
```

---

## STEP 5 — Draft + publish endpoints in router.py

=== MODIFY: backend/app/modules/pulse/router.py ===
ACTION: add draft, commit, and publish routes after DELETE /schedule/shifts/{shift_id}

```python
# ── Draft auto-populate ──────────────────────────────────────────────────────

class DraftSlotIn(BaseModel):
    date: str                           # YYYY-MM-DD
    start_min: int                      # minutes from midnight
    end_min: int
    shift_type: str = "shift"
    shift_definition_id: str | None = None
    shift_code: str | None = None
    required_certs: list[str] = []
    facility_id: str | None = None


class DraftAssignmentOut(BaseModel):
    slot_date: str
    slot_start_min: int
    slot_end_min: int
    slot_shift_type: str
    shift_definition_id: str | None
    shift_code: str | None
    facility_id: str | None
    user_id: str
    user_name: str
    score: float
    warnings: list[str]


class DraftConflictOut(BaseModel):
    slot_date: str
    slot_start_min: int
    slot_shift_type: str
    reason: str


class DraftResultOut(BaseModel):
    assignments: list[DraftAssignmentOut]
    conflicts: list[DraftConflictOut]
    total_slots: int


class BuildDraftIn(BaseModel):
    slots: list[DraftSlotIn]
    period_start: str               # YYYY-MM-DD
    period_end: str                 # YYYY-MM-DD
    max_hours_per_worker: float = 160
    fairness_enabled: bool = True


@router.post("/schedule/draft", response_model=DraftResultOut)
async def build_schedule_draft(
    body: BuildDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_manager_or_above)],
) -> DraftResultOut:
    """Auto-populate draft. Does NOT create shifts — supervisor reviews first."""
    from app.modules.pulse.draft_engine import build_draft, DraftSlot as EngineDraftSlot
    from datetime import date as date_type

    cid = str(user.company_id)
    slots = [
        EngineDraftSlot(
            date=date_type.fromisoformat(s.date),
            start_min=s.start_min,
            end_min=s.end_min,
            shift_type=s.shift_type,
            shift_definition_id=s.shift_definition_id,
            shift_code=s.shift_code,
            required_certs=s.required_certs,
            facility_id=s.facility_id,
        )
        for s in body.slots
    ]

    result = await build_draft(
        db=db,
        company_id=cid,
        slots=slots,
        period_start=date_type.fromisoformat(body.period_start),
        period_end=date_type.fromisoformat(body.period_end),
        max_hours_per_worker=body.max_hours_per_worker,
        fairness_enabled=body.fairness_enabled,
    )

    return DraftResultOut(
        total_slots=result.total_slots,
        assignments=[
            DraftAssignmentOut(
                slot_date=str(a.slot.date),
                slot_start_min=a.slot.start_min,
                slot_end_min=a.slot.end_min,
                slot_shift_type=a.slot.shift_type,
                shift_definition_id=a.slot.shift_definition_id,
                shift_code=a.slot.shift_code,
                facility_id=a.slot.facility_id,
                user_id=a.user_id,
                user_name=a.user_name,
                score=round(a.score, 2),
                warnings=a.warnings,
            )
            for a in result.assignments
        ],
        conflicts=[
            DraftConflictOut(
                slot_date=str(c.slot.date),
                slot_start_min=c.slot.start_min,
                slot_shift_type=c.slot.shift_type,
                reason=c.reason,
            )
            for c in result.conflicts
        ],
    )


class CommitDraftIn(BaseModel):
    assignments: list[DraftAssignmentOut]


@router.post("/schedule/draft/commit", status_code=201)
async def commit_schedule_draft(
    body: CommitDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_manager_or_above)],
) -> dict:
    """Create shifts from a reviewed draft."""
    from datetime import timezone

    cid = str(user.company_id)
    created = 0

    for a in body.assignments:
        d = date.fromisoformat(a.slot_date)
        starts_at = datetime.combine(
            d,
            time(hour=a.slot_start_min // 60, minute=a.slot_start_min % 60),
            tzinfo=timezone.utc,
        )
        end_h, end_m = a.slot_end_min // 60, a.slot_end_min % 60
        ends_at = datetime.combine(d, time(hour=end_h, minute=end_m), tzinfo=timezone.utc)
        if ends_at <= starts_at:
            ends_at += timedelta(days=1)

        shift = PulseScheduleShift(
            company_id=cid,
            assigned_user_id=a.user_id,
            facility_id=a.facility_id,
            shift_definition_id=a.shift_definition_id,
            shift_code=a.shift_code,
            starts_at=starts_at,
            ends_at=ends_at,
            shift_type=a.slot_shift_type,
            shift_kind="workforce",
            is_draft=False,
        )
        db.add(shift)
        created += 1

    await db.commit()
    return {"ok": True, "shifts_created": created}


# ── Publish ──────────────────────────────────────────────────────────────────

class PublishScheduleIn(BaseModel):
    period_start: str
    period_end: str
    notify_workers: bool = True


@router.post("/schedule/publish")
async def publish_schedule(
    body: PublishScheduleIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_manager_or_above)],
) -> dict:
    """Mark period as published. Fires domain event for push notification pipeline."""
    from app.core.events.engine import event_engine
    from app.core.events.types import DomainEvent

    cid = str(user.company_id)

    await event_engine.publish(DomainEvent(
        event_type="schedule.period_published",
        company_id=cid,
        entity_id=f"{body.period_start}:{body.period_end}",
        source_module="schedule",
        metadata={
            "period_start":   body.period_start,
            "period_end":     body.period_end,
            "notify_workers": body.notify_workers,
            "published_by":   str(user.id),
        },
    ))

    return {"ok": True, "period_start": body.period_start, "period_end": body.period_end}
```

Note: add these imports near top of router.py if not already present:
```python
from datetime import date, datetime, time, timedelta
```

---

## STEP 6 — ScheduleDraftPanel component

=== FILE: frontend/components/schedule/ScheduleDraftPanel.tsx ===

```tsx
"use client";

import { AlertTriangle, CheckCircle, Loader2, Users, X } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export type DraftAssignment = {
  slot_date: string;
  slot_start_min: number;
  slot_end_min: number;
  slot_shift_type: string;
  shift_definition_id: string | null;
  shift_code: string | null;
  facility_id: string | null;
  user_id: string;
  user_name: string;
  score: number;
  warnings: string[];
};

export type DraftConflict = {
  slot_date: string;
  slot_start_min: number;
  slot_shift_type: string;
  reason: string;
};

export type DraftResult = {
  assignments: DraftAssignment[];
  conflicts: DraftConflict[];
  total_slots: number;
};

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Props = {
  draft: DraftResult;
  companyId: string | null;
  onCommit: () => void;
  onDiscard: () => void;
};

export function ScheduleDraftPanel({ draft, companyId, onCommit, onDiscard }: Props) {
  const [committing, setCommitting] = useState(false);
  const [committed,  setCommitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const url = companyId
        ? `/api/v1/pulse/schedule/draft/commit?company_id=${encodeURIComponent(companyId)}`
        : "/api/v1/pulse/schedule/draft/commit";
      await apiFetch(url, {
        method: "POST",
        body: JSON.stringify({ assignments: draft.assignments }),
      });
      setCommitted(true);
      onCommit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to commit draft");
    } finally {
      setCommitting(false);
    }
  };

  if (committed) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {draft.assignments.length} shifts created
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Schedule updated — refresh to see all shifts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ds-border bg-ds-primary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ds-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-ds-accent" />
          <span className="text-sm font-bold text-ds-foreground">
            Draft — {draft.assignments.length} of {draft.total_slots} slots filled
          </span>
        </div>
        <button onClick={onDiscard} className="text-ds-muted hover:text-ds-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {draft.conflicts.length > 0 && (
        <div className="px-4 py-3 border-b border-ds-border bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-100 uppercase tracking-wide">
              {draft.conflicts.length} conflict{draft.conflicts.length !== 1 ? "s" : ""} need attention
            </span>
          </div>
          <ul className="space-y-1">
            {draft.conflicts.map((c, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-semibold">{c.slot_date} · {c.slot_shift_type}</span>
                {" — "}{c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3 max-h-56 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted mb-2">
          Assigned shifts
        </p>
        <ul className="space-y-1.5">
          {draft.assignments.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-ds-foreground">{a.user_name}</span>
              <span className="text-ds-muted">
                {a.slot_date}
                {a.shift_code && (
                  <span className="ml-1 font-bold text-ds-accent">{a.shift_code}</span>
                )}
                {" "}{minToTime(a.slot_start_min)}–{minToTime(a.slot_end_min)}
              </span>
              {a.warnings.length > 0 && (
                <span className="text-amber-500" title={a.warnings.join(", ")}>⚠</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-ds-border">
        <button
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted hover:text-ds-foreground"
        >
          Discard
        </button>
        <button
          onClick={handleCommit}
          disabled={committing || draft.assignments.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-4 py-1.5 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
        >
          {committing && <Loader2 className="h-3 w-3 animate-spin" />}
          {committing ? "Creating…" : `Accept ${draft.assignments.length} shifts`}
        </button>
      </div>
    </div>
  );
}
```

---

## STEP 7 — Wire Build Draft into ScheduleApp

=== MODIFY: frontend/components/schedule/ScheduleApp.tsx ===

ACTION: 4 small changes

Change A — Add import near top:
```tsx
import { ScheduleDraftPanel, type DraftResult } from "./ScheduleDraftPanel";
```

Change B — Add state near other useState declarations:
```tsx
const [draftResult,   setDraftResult]   = useState<DraftResult | null>(null);
const [buildingDraft, setBuildingDraft] = useState(false);
```

Change C — Add handler near other handlers (after the shift save handler):
```tsx
const handleBuildDraft = async () => {
  if (!visibleDates.length) return;
  setBuildingDraft(true);
  try {
    // Build one slot per visible date using workDayStart/End from settings
    // Convert HH:MM → minutes from midnight
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const startMin = toMin(settings.workDayStart || "07:00");
    const endMin   = toMin(settings.workDayEnd   || "15:00");

    const slots = visibleDates.map(date => ({
      date,
      start_min:  startMin,
      end_min:    endMin,
      shift_type: "shift",
      shift_definition_id: null,
      shift_code: null,
      required_certs: [],
      facility_id: zones[0]?.id ?? null,
    }));

    const url = effectiveCompanyId
      ? `/api/v1/pulse/schedule/draft?company_id=${encodeURIComponent(effectiveCompanyId)}`
      : "/api/v1/pulse/schedule/draft";

    const result = await apiFetch<DraftResult>(url, {
      method: "POST",
      body: JSON.stringify({
        slots,
        period_start: visibleDates[0],
        period_end:   visibleDates[visibleDates.length - 1],
        max_hours_per_worker: settings.staffing.maxHoursPerWorkerPerWeek || 160,
        fairness_enabled: true,
      }),
    });
    setDraftResult(result);
  } catch (e) {
    console.error("Draft build failed", e);
  } finally {
    setBuildingDraft(false);
  }
};
```

Change D — Find the schedule toolbar area (near Save / Undo buttons).
Add Build Draft button when canEdit and no draft is showing:
```tsx
{canEdit && !draftResult && (
  <button
    type="button"
    onClick={handleBuildDraft}
    disabled={buildingDraft}
    className="inline-flex items-center gap-1.5 rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted hover:text-ds-foreground disabled:opacity-60"
  >
    {buildingDraft ? "Building…" : "✦ Build Draft"}
  </button>
)}
```

Change E — Render ScheduleDraftPanel below the toolbar when draft exists.
Find the main content area just below the toolbar and add:
```tsx
{draftResult && (
  <ScheduleDraftPanel
    draft={draftResult}
    companyId={effectiveCompanyId}
    onCommit={() => { setDraftResult(null); void refreshSchedule(); }}
    onDiscard={() => setDraftResult(null)}
  />
)}
```
`refreshSchedule` is whatever function ScheduleApp uses to reload shifts from the API.
If it's named differently, use the correct function name.

---

## EXECUTION STEPS
1. Modify frontend/lib/schedule/pulse-bridge.ts (Step 1)
2. Modify frontend/lib/schedule/types.ts — add shiftCode + shiftDefinitionId (Step 1)
3. Modify frontend/components/schedule/ScheduleCompactCellRows.tsx (Step 2)
4. Modify frontend/components/schedule/ScheduleWorkerPanel.tsx (Step 3)
5. Create backend/app/modules/pulse/draft_engine.py (Step 4)
6. Modify backend/app/modules/pulse/router.py — add draft/commit/publish routes (Step 5)
7. Create frontend/components/schedule/ScheduleDraftPanel.tsx (Step 6)
8. Modify frontend/components/schedule/ScheduleApp.tsx (Step 7)
9. cd frontend && npm run build
10. git add -A && git commit -m "feat(schedule): phase 3 — shift codes on chips, cert filtering, auto-populate draft, publish"
11. git push origin main

---

## VALIDATION
- [ ] Shift code badge (e.g. D1, PM2) appears on shift chips when shift has a code
- [ ] Workers missing required certs are greyed out in worker panel during shift drag
- [ ] Build Draft button visible for managers in schedule toolbar
- [ ] Draft panel shows assignments and conflicts after building
- [ ] Accept N shifts creates shifts and refreshes schedule
- [ ] Discard closes panel without changes
- [ ] Publish endpoint returns 200 and fires domain event
- [ ] npm run build passes with no TypeScript errors
- [ ] No regression on existing drag highlight tones (still working)

---

## UPDATE handoffs/current_state.md
After all steps complete, update handoffs/current_state.md:
- Add to What's Live: Schedule Phase 3 — shift code chips, cert filtering in worker panel, auto-populate draft engine (POST /pulse/schedule/draft + /draft/commit), publish endpoint
- Remove from Pending: Schedule Phase 3
- Add to Pending: Schedule Phase 4 (calendar overlay + My Shifts view), Phase 5 (assignment builder)
- Update Last Updated
git add handoffs/current_state.md
git commit -m "chore: update current_state after schedule phase 3"
