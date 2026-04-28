
# Pulse · Audit + Complete — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and handoff/contracts.md.
This is an AUDIT task. For each item below, check if it exists and works.
If it exists and is correct: mark DONE.
If it is missing or incomplete: implement it.
Check files before writing. Do not duplicate existing code.
Run cd frontend && npm run build before committing.
Commit after each phase with the message provided."

---

## HOW TO AUDIT

For each item, run the check command first.
If the check passes → mark DONE, move on.
If the check fails → implement the fix, then mark DONE.

---

## PHASE A — Schedule: Shift Definitions + Legend

### A1 — Shift definitions builder UI [ ]
CHECK:
```bash
find frontend/app/schedule -name "shift-definitions*" -o -name "shift-def*"
grep -rn "shift_definition\|ShiftDefinition\|shift-definitions" frontend/app/schedule/
```
EXPECTED: A page at `frontend/app/schedule/shift-definitions/page.tsx` that:
- Lists existing shift definitions (GET /api/v1/pulse/schedule/shift-definitions)
- Allows creating new ones (code, name, start_min, end_min, shift_type, color, cert_requirements)
- Allows editing and deleting existing ones

IF MISSING: Create `frontend/app/schedule/shift-definitions/page.tsx` with a simple
CRUD table. Follow the pattern of other settings pages in the app.
Use apiFetch. Auth guard with readSession() + navigateToPulseLogin().

### A2 — Shift code badge on schedule grid chips [ ]
CHECK:
```bash
grep -n "shift_code\|shiftCode\|shift\.code" frontend/components/schedule/ScheduleCompactCellRows.tsx
grep -n "shift_code\|shiftCode" frontend/lib/schedule/pulse-bridge.ts
```
EXPECTED: `pulse-bridge.ts` maps `shift_code` from API → local Shift type.
`ScheduleCompactCellRows.tsx` renders a small badge when `shift.shiftCode` is set.

IF MISSING: 
In `frontend/lib/schedule/types.ts` add to Shift interface:
```ts
shiftCode?: string;
shiftDefinitionId?: string;
```
In `frontend/lib/schedule/pulse-bridge.ts` in the shift mapping function add:
```ts
shiftCode: raw.shift_code ?? undefined,
shiftDefinitionId: raw.shift_definition_id ?? undefined,
```
In `frontend/components/schedule/ScheduleCompactCellRows.tsx` find where
the shift chip content renders. Add before the worker name:
```tsx
{shift.shiftCode && (
  <span className="inline-flex items-center rounded px-1 text-[9px] font-bold
    uppercase tracking-wide bg-ds-accent/15 text-ds-accent mr-1">
    {shift.shiftCode}
  </span>
)}
```

### A3 — Legend panel [ ]
CHECK:
```bash
find frontend/components/schedule -name "*Legend*" -o -name "*legend*"
grep -n "Legend\|legend" frontend/components/schedule/ScheduleApp.tsx | head -10
```
EXPECTED: `ScheduleLegendPanel.tsx` exists and is rendered in `ScheduleApp.tsx`.
Shows shift codes with their colors and cert requirements.

IF MISSING: Create `frontend/components/schedule/ScheduleLegendPanel.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type ShiftDef = {
  id: string; code: string; name: string | null;
  start_min: number; end_min: number; shift_type: string;
  color: string | null; cert_requirements: string[];
};

function minToTime(m: number) {
  const h = Math.floor(m / 60); const mm = m % 60;
  return `${h % 12 || 12}:${String(mm).padStart(2,"0")}${h < 12 ? "am" : "pm"}`;
}

export function ScheduleLegendPanel({ companyId }: { companyId: string | null }) {
  const [defs, setDefs] = useState<ShiftDef[]>([]);
  useEffect(() => {
    const url = companyId
      ? `/api/v1/pulse/schedule/shift-definitions?company_id=${companyId}`
      : "/api/v1/pulse/schedule/shift-definitions";
    apiFetch<ShiftDef[]>(url).then(setDefs).catch(() => {});
  }, [companyId]);
  if (!defs.length) return null;
  return (
    <div className="rounded-md border border-ds-border bg-ds-primary p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted mb-2">
        Shift Legend
      </p>
      <div className="space-y-1">
        {defs.map(d => (
          <div key={d.id} className="flex items-center gap-2">
            <span className="font-bold text-ds-accent w-8">{d.code}</span>
            <span className="text-ds-muted">{minToTime(d.start_min)}–{minToTime(d.end_min)}</span>
            {d.cert_requirements.length > 0 && (
              <span className="text-ds-muted">· {d.cert_requirements.join(", ")}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```
Then in `ScheduleApp.tsx` import and render it in the sidebar or below the toolbar.

Commit: `feat(schedule): shift definition builder, shift code chips, legend panel`

---

## PHASE B — Schedule: Availability + Periods

### B1 — Availability submission wired to period API [ ]
CHECK:
```bash
find frontend/app/schedule -name "availability*"
grep -n "period_id\|schedule/availability\|schedule/periods" frontend/app/schedule/availability/page.tsx 2>/dev/null | head -10
```
EXPECTED: `frontend/app/schedule/availability/page.tsx` exists and calls
`POST /api/v1/pulse/schedule/availability` with `period_id` from
`GET /api/v1/pulse/schedule/periods`.

IF MISSING OR NOT WIRED TO PERIODS: Update the availability page to:
1. Fetch active period: `GET /api/v1/pulse/schedule/periods`
   - Find period where status is "draft" or "open"
2. Show the period dates as context
3. On save, POST to `/api/v1/pulse/schedule/availability` with:
   ```json
   { "period_id": "<active_period_id>", "windows": [...], "exceptions": [] }
   ```
If no active period exists, show: "No open availability window. Check back later."

### B2 — Supervisor availability grid [ ]
CHECK:
```bash
find frontend/app/schedule -name "availability-grid*"
grep -n "availability-grid\|AvailabilityGrid\|submissions" frontend/app/schedule/ -r 2>/dev/null | head -10
```
EXPECTED: `frontend/app/schedule/availability-grid/page.tsx` shows all workers
and whether they've submitted availability for the active period.
Calls `GET /api/v1/pulse/schedule/availability?period_id=...`

IF MISSING: Create a minimal version:
```tsx
// frontend/app/schedule/availability-grid/page.tsx
// Shows: worker name | submitted? | actions
// GET /api/v1/pulse/schedule/periods → find active
// GET /api/v1/pulse/schedule/availability?period_id=... → list submissions
// For each worker not in submissions list → show "Not submitted" + [Remind] button
// [Remind] → TODO (push notification — stub for now)
```

### B3 — Acknowledgement button on My Shifts [ ]
CHECK:
```bash
grep -n "acknowledge\|Acknowledge" frontend/app/schedule/availability/page.tsx 2>/dev/null
grep -n "acknowledge\|Acknowledge" frontend/components/schedule/ScheduleApp.tsx | head -5
```
EXPECTED: Workers can tap "Acknowledge schedule" after viewing their shifts.
Calls `POST /api/v1/pulse/schedule/acknowledge` with `{ period_id }`.

IF MISSING: In ScheduleApp.tsx or the My Shifts view, add a button that:
1. Fetches active period
2. Shows "Acknowledge schedule" banner if not yet acknowledged
3. On tap, POSTs to `/api/v1/pulse/schedule/acknowledge`
4. Replaces banner with "✓ Schedule acknowledged"

Commit: `feat(schedule): availability period wiring, supervisor grid, acknowledgement`

---

## PHASE C — Schedule: Builder Improvements

### C1 — Draft engine backend [ ]
CHECK:
```bash
find backend/app/modules/pulse -name "draft*"
grep -n "schedule/draft\|build_draft\|BuildDraft" backend/app/modules/pulse/router.py | head -10
```
EXPECTED:
- `backend/app/modules/pulse/draft_engine.py` exists
- `POST /api/v1/pulse/schedule/draft` route exists in router.py
- `POST /api/v1/pulse/schedule/draft/commit` route exists

IF MISSING: Create `backend/app/modules/pulse/draft_engine.py` and add routes.
See `handoff/integration.md` history — the full implementation was provided.
Key points:
- Reads availability from `pulse_schedule_availability_submissions`
- Reads shift definitions from `pulse_schedule_shift_definitions`
- Scores workers by: availability match, cert match, hours in period, fairness
- Returns assignments + conflicts — does NOT create shifts
- `/draft/commit` creates the actual shifts

### C2 — Build Draft button + ScheduleDraftPanel [ ]
CHECK:
```bash
find frontend/components/schedule -name "ScheduleDraftPanel*"
grep -n "Build Draft\|buildDraft\|draftResult\|DraftPanel" frontend/components/schedule/ScheduleApp.tsx | head -10
```
EXPECTED:
- `frontend/components/schedule/ScheduleDraftPanel.tsx` exists
- `ScheduleApp.tsx` has a "Build Draft" button for managers
- Clicking it calls `POST /api/v1/pulse/schedule/draft`
- Shows panel with assignments and conflicts
- "Accept N shifts" calls `/draft/commit`

IF MISSING: 
Create `ScheduleDraftPanel.tsx` — shows assignments list + conflicts with reasons.
Add to `ScheduleApp.tsx`:
```tsx
// State
const [draftResult, setDraftResult] = useState(null);
const [buildingDraft, setBuildingDraft] = useState(false);

// Button in toolbar (managers only)
{canEdit && !draftResult && (
  <button onClick={buildDraft} disabled={buildingDraft}
    className="inline-flex items-center gap-1.5 rounded-md border border-ds-border
      bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted
      hover:text-ds-foreground disabled:opacity-60">
    {buildingDraft ? "Building…" : "✦ Build Draft"}
  </button>
)}

// Panel below toolbar
{draftResult && (
  <ScheduleDraftPanel
    draft={draftResult}
    companyId={effectiveCompanyId}
    onCommit={() => { setDraftResult(null); void refreshSchedule(); }}
    onDiscard={() => setDraftResult(null)}
  />
)}
```

### C3 — Drag visual states for worker panel [ ]
CHECK:
```bash
grep -n "opacity-40\|cert.*filter\|meetsReq\|activeCert\|dragSession.*cert" frontend/components/schedule/ScheduleWorkerPanel.tsx | head -10
grep -n "workerHighlightByDate\|dragHighlight\|tone.*good\|tone.*invalid" frontend/components/schedule/ScheduleCalendarGrid.tsx | head -10
```
EXPECTED:
- Calendar cells show green/amber/red during worker drag (highlight tones)
- Workers missing required certs are greyed out in worker panel during drag

IF DRAG HIGHLIGHTS MISSING: Check `frontend/lib/schedule/worker-drag-highlights.ts` exists.
If it exists and `buildWorkerDragHighlightMap` is not called in ScheduleApp, wire it:
```tsx
const dragHighlightMap = useMemo(() => {
  if (!dragSession || dragSession.kind !== "worker") return {};
  const worker = workers.find(w => w.id === dragSession.workerId);
  if (!worker) return {};
  return buildWorkerDragHighlightMap(worker, visibleDates, shifts, settings, timeOffBlocks);
}, [dragSession, workers, visibleDates, shifts, settings, timeOffBlocks]);
```
Pass as `workerHighlightByDate={dragHighlightMap}` to ScheduleCalendarGrid.

IF CERT FILTERING MISSING in ScheduleWorkerPanel: Add:
```tsx
const activeCertReqs: string[] = useMemo(() => {
  if (!dragSession || dragSession.kind !== "shift") return [];
  const s = shifts.find(x => x.id === dragSession.shiftId);
  return s?.required_certifications ?? [];
}, [dragSession, shifts]);
```
Apply `opacity-40 pointer-events-none` to workers missing required certs.

### C4 — Publish button [ ]
CHECK:
```bash
grep -n "Publish\|publish.*schedule\|schedule/publish" frontend/components/schedule/ScheduleApp.tsx | head -10
grep -n "schedule/publish" backend/app/modules/pulse/router.py | head -5
```
EXPECTED:
- `POST /api/v1/pulse/schedule/publish` exists in router.py
- "Publish schedule" button in ScheduleApp toolbar for managers

IF MISSING: Add publish route to router.py (fires `schedule.period_published` domain event).
Add button to ScheduleApp toolbar next to Build Draft.

Commit: `feat(schedule): draft engine, build draft UI, drag states, publish button`

---

## PHASE D — Schedule: My Shifts + Assignment Builder

### D1 — My Shifts view [ ]
CHECK:
```bash
grep -n "my-shifts\|MyShifts\|my_shifts\|\"my\"" frontend/components/schedule/ScheduleApp.tsx | head -10
find frontend/components/schedule -name "*MyShift*"
```
EXPECTED: A "My Shifts" tab or view in ScheduleApp showing only the
current user's shifts, grouped chronologically. Uses `currentUserId` from session.

IF MISSING: Add to ScheduleApp:
1. Add `"my-shifts"` to the View type
2. Add tab button for "My Shifts" with User icon
3. Filter shifts by `shift.workerId === currentUserId`
4. Render as a simple chronological list (not the full grid)
Create `frontend/components/schedule/ScheduleMyShiftsView.tsx` if needed.

### D2 — Assignment work queue in Day view [ ]
CHECK:
```bash
grep -n "work.queue\|work_queue\|WorkQueue\|overdue.*pm\|open.*work" frontend/components/schedule/ScheduleDayView.tsx | head -10
grep -n "schedule/shifts.*work-queue\|work-queue" backend/app/modules/pulse/router.py | head -5
```
EXPECTED:
- `GET /api/v1/pulse/schedule/shifts/{shift_id}/work-queue` exists
- ScheduleDayView shows open work requests + overdue PMs for the shift's zone
- Assignment panel works for all shift types (not just nights)

IF MISSING:
Add to router.py:
```python
@router.get("/schedule/shifts/{shift_id}/work-queue")
async def get_shift_work_queue(shift_id: str, db: ..., user: ...) -> dict:
    # Returns open WRs + overdue PMs for the shift's zone
    # See handoff/integration.md Phase 5 for full implementation
```

In ScheduleDayView.tsx:
- Remove nightAssignmentsEnabled guard (assignments work for all shifts)
- Fetch work queue on mount
- Render overdue PMs and open WRs below assignments

Commit: `feat(schedule): my shifts view, assignment work queue, day view for all shifts`

---

## PHASE E — Mobile App Audit

### E1 — Check tab structure [ ]
```bash
cat "MobileApp/app/(tabs)/_layout.tsx" | grep -A 2 "Tabs.Screen"
```
EXPECTED: 6 tabs — Home, Tasks, Schedule, Documents, Search, Profile
IF WRONG: Fix to match the 6-tab structure from M1integration.md

### E2 — Check Home screen loads real data [ ]
```bash
grep -n "listShifts\|listMyTasks\|listNotifications\|listMyTools" MobileApp/components/dashboard/DashboardScreen.tsx | head -10
```
EXPECTED: DashboardScreen fetches all 4 data sources (shifts, tasks, tools, notifications)
IF STILL HARDCODED: Apply M1integration.md DashboardScreen replacement

### E3 — Check inference confirmation screen [ ]
```bash
find MobileApp/app -name "inference-confirm*"
grep -n "inference.confirm\|InferenceConfirm" "MobileApp/app/(tabs)/_layout.tsx" 2>/dev/null
grep -n "inference" MobileApp/components/ProximityPromptBanner.tsx | head -5
```
EXPECTED: `MobileApp/app/inference-confirm.tsx` exists.
ProximityPromptBanner subscribes to WS events and navigates to it on tap.
IF MISSING: Apply M2integration.md

### E4 — Check Documents tab [ ]
```bash
find "MobileApp/app/(tabs)" -name "documents*"
```
EXPECTED: `MobileApp/app/(tabs)/documents.tsx` exists with Procedures/Drawings/Logs tabs
IF MISSING: Apply M3integration.md

### E5 — Check Search screen [ ]
```bash
find "MobileApp/app/(tabs)" -name "search*"
grep -n "unified_search\|/api/v1/search" backend/app/api/search_routes.py 2>/dev/null | head -5
```
EXPECTED: `MobileApp/app/(tabs)/search.tsx` exists.
`backend/app/api/search_routes.py` exists and is registered in main.py.
IF MISSING: Apply M4integration.md

### E6 — Check Profile screen [ ]
```bash
find "MobileApp/app/(tabs)" -name "profile*"
```
EXPECTED: `MobileApp/app/(tabs)/profile.tsx` with XP, leaderboard, certs, settings
IF MISSING: Apply M5integration.md

### E7 — Check push notifications wiring [ ]
```bash
grep -n "registerNotification\|push.token\|notifyLocal\|subscribePulseWs" "MobileApp/app/_layout.tsx" | head -10
find backend/app/api -name "notifications_routes*"
```
EXPECTED: `_layout.tsx` registers push token on login and subscribes to WS for local notifications.
`backend/app/api/notifications_routes.py` exists and is registered in main.py.
IF MISSING: Apply M6integration.md

Commit: `fix(mobile): complete any missing M1-M6 screens and wiring`

---

## PHASE F — Gamification: Missing Pieces

### F1 — Missing event subscribers [ ]
CHECK:
```bash
grep -n "inference_confirmed\|procedure_completed\|pm_completed_on_time\|shift_started\|inspection_sheet" backend/app/services/xp_event_subscribers.py | head -10
```
EXPECTED: All 5 new subscribers registered in `attach_xp_event_subscribers()`
IF MISSING: Add to `xp_event_subscribers.py` — see `handoff/gamification.md` Section 2 for full code

### F2 — Leaderboard endpoint [ ]
CHECK:
```bash
grep -n "leaderboard" backend/app/api/gamification_routes.py | head -5
```
EXPECTED: `GET /api/v1/gamification/leaderboard` returns ranked list with `is_me` flag
IF MISSING: Add to `gamification_routes.py` — see `handoff/gamification.md` Section 8

### F3 — Worker gamification endpoint [ ]
CHECK:
```bash
grep -n "workers.*gamification\|worker.*gamif" backend/app/api/gamification_routes.py | head -5
```
EXPECTED: `GET /api/v1/workers/{user_id}/gamification` exists
IF MISSING: Add to `gamification_routes.py` — see `handoff/gamification.md` Section 8

### F4 — Certifications endpoint [ ]
CHECK:
```bash
grep -n "workers/me/certifications\|certifications" backend/app/api/gamification_routes.py | head -5
```
EXPECTED: `GET /api/v1/workers/me/certifications` exists
IF MISSING: Add to `gamification_routes.py` — see `handoff/gamification.md` Section 8

### F5 — Badge definitions seeded [ ]
CHECK:
```bash
# In psql or via API:
# SELECT count(*) FROM badge_definitions;
# Should be > 10
grep -n "badge_definitions\|INSERT.*badge" backend/alembic/versions/ -r | head -10
```
EXPECTED: Badge definitions seeded in a migration (inference_5, pm_guardian_5, first_task etc)
IF MISSING: Create new migration that seeds badge definitions from `handoff/gamification.md` Section 7

Commit: `feat(gamification): missing subscribers, leaderboard, worker gamification, certifications, badge seeds`

---

## EXECUTION ORDER
1. Run Phase A checks → implement missing items → commit
2. Run Phase B checks → implement missing items → commit
3. Run Phase C checks → implement missing items → commit
4. Run Phase D checks → implement missing items → commit
5. Run Phase E checks → implement missing items → commit
6. Run Phase F checks → implement missing items → commit
7. cd frontend && npm run build (fix any TypeScript errors)
8. git push origin main

---

## VALIDATION (after all phases)
- [ ] Shift codes (D1, PM2, N1) show as badges on schedule grid chips
- [ ] Shift definition builder accessible at /schedule/shift-definitions
- [ ] Legend panel renders in schedule UI
- [ ] Availability page fetches active period and submits with period_id
- [ ] Supervisor availability grid shows submission status per worker
- [ ] Build Draft button appears in schedule toolbar for managers
- [ ] Draft panel shows assignments + conflicts on build
- [ ] My Shifts view shows personal shifts only
- [ ] Day view assignment panel works for all shift types
- [ ] Mobile: 6 tabs (Home, Tasks, Schedule, Documents, Search, Profile)
- [ ] Mobile: Home loads real API data (shift, tasks, tools, notifications)
- [ ] Mobile: inference-confirm.tsx exists and is reachable from banner
- [ ] Mobile: Documents tab has Procedures/Drawings/Logs sub-tabs
- [ ] Mobile: Search screen with debounced search
- [ ] Mobile: Profile screen with XP display
- [ ] GET /api/v1/gamification/leaderboard returns ranked list
- [ ] 5 new XP subscribers registered
- [ ] Badge definitions seeded in DB
- [ ] npm run build passes

---

## UPDATE handoff/current_state.md
After all phases complete:
- Mark all schedule phases (1-5) as live
- Mark all mobile phases (M1-M6) as verified complete
- Mark gamification missing pieces as complete
- Note any items that remained BLOCKED with reason
- Update Last Updated
git add handoff/current_state.md
git commit -m "chore: update current_state after full audit and completion pass"
