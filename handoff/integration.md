# Pulse · 5 Gap Fixes — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and handoff/contracts.md.
Execute phases in order. Check before creating. Do not duplicate existing code.
Run cd frontend && npm run build before committing.
Commit after each phase with message provided."

---

## WHAT EXISTS (verified — do not recreate)
- Full onboarding system: AdminOnboardingChecklist, OnboardingProvider, OnboardingChecklist,
  NonAdminOnboardingModal, onboarding_service.py, onboarding_routes.py
- Current 4 admin steps: create_work_order, add_equipment, invite_team, customize_workflow
- try_mark_onboarding_step() — auto-marks steps when actions are taken
- onboarding_reality.py — checks real DB state to mark steps complete
- ScheduleApp, ScheduleMyShiftsView, ScheduleDayView all exist
- pulse_schedule_periods, pulse_schedule_shift_definitions tables exist

---

## GAP 1 — Period management UI for supervisors

### Problem
Supervisors have no visible way to create a period, set deadlines, or open
availability collection. The period API exists but there is no UI entry point.

### Fix

=== MODIFY: frontend/components/schedule/ScheduleApp.tsx ===
ACTION: add period management controls to the schedule toolbar

Check what already exists:
```bash
grep -n "period\|Period\|createPeriod\|openPeriod" frontend/components/schedule/ScheduleApp.tsx | head -15
```

If period controls don't exist, add a period status bar between the toolbar
and the calendar. It shows the current period status and lets managers act:

```tsx
// Add state near other schedule state:
const [activePeriod, setActivePeriod] = useState<{
  id: string; start_date: string; end_date: string;
  status: string; availability_deadline: string | null;
  publish_deadline: string | null;
} | null>(null);
const [showPeriodModal, setShowPeriodModal] = useState(false);

// Load active period on mount (after shifts load):
useEffect(() => {
  if (!effectiveCompanyId && !isApiMode()) return;
  apiFetch<Array<typeof activePeriod>>(
    effectiveCompanyId
      ? `/api/v1/pulse/schedule/periods?company_id=${effectiveCompanyId}`
      : "/api/v1/pulse/schedule/periods"
  ).then(periods => {
    const open = periods?.find(p => p?.status === "open" || p?.status === "draft");
    setActivePeriod(open ?? null);
  }).catch(() => {});
}, [effectiveCompanyId]);

// Render period status bar below toolbar (above calendar):
{canEdit && (
  <div className="flex items-center justify-between gap-3 rounded-md border
    border-ds-border bg-ds-secondary px-4 py-2 text-xs">
    {activePeriod ? (
      <>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${
            activePeriod.status === "open" ? "bg-emerald-500" : "bg-amber-400"
          }`} />
          <span className="font-semibold text-ds-foreground">
            {activePeriod.status === "open" ? "Availability open" : "Period draft"}
            {" · "}{activePeriod.start_date} – {activePeriod.end_date}
          </span>
          {activePeriod.availability_deadline && (
            <span className="text-ds-muted">
              · Due {new Date(activePeriod.availability_deadline).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPeriodModal(true)}
          className="text-ds-accent font-semibold hover:underline"
        >
          Manage period
        </button>
      </>
    ) : (
      <>
        <span className="text-ds-muted">No active period. Create one to collect availability.</span>
        <button
          onClick={() => setShowPeriodModal(true)}
          className="inline-flex items-center gap-1 rounded-md bg-ds-accent px-3 py-1
            text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90"
        >
          + Create period
        </button>
      </>
    )}
  </div>
)}
```

=== FILE: frontend/components/schedule/SchedulePeriodModal.tsx ===

```tsx
"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companyId: string | null;
  existing?: {
    id: string; start_date: string; end_date: string;
    status: string; availability_deadline: string | null;
    publish_deadline: string | null;
  } | null;
};

export function SchedulePeriodModal({ open, onClose, onSaved, companyId, existing }: Props) {
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate,   setEndDate]   = useState(existing?.end_date ?? "");
  const [availDeadline, setAvailDeadline] = useState(
    existing?.availability_deadline?.slice(0, 10) ?? ""
  );
  const [publishDeadline, setPublishDeadline] = useState(
    existing?.publish_deadline?.slice(0, 10) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const cq = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";

  const save = async () => {
    if (!startDate || !endDate) { setErr("Start and end dates are required."); return; }
    setSaving(true); setErr(null);
    try {
      const body = {
        start_date: startDate, end_date: endDate,
        availability_deadline: availDeadline ? `${availDeadline}T23:59:00Z` : null,
        publish_deadline:      publishDeadline ? `${publishDeadline}T23:59:00Z` : null,
        status: "open",
      };
      if (existing) {
        await apiFetch(`/api/v1/pulse/schedule/periods/${existing.id}${cq}`,
          { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/v1/pulse/schedule/periods${cq}`,
          { method: "POST", body: JSON.stringify(body) });
      }
      onSaved(); onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save period");
    } finally { setSaving(false); }
  };

  const Field = ({ label, type, value, onChange }: {
    label: string; type: string; value: string; onChange: (v: string) => void;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-ds-muted mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2
          text-sm text-ds-foreground focus:outline-none focus:ring-2 focus:ring-ds-accent" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-xl border border-ds-border bg-ds-primary shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ds-foreground">
            {existing ? "Edit period" : "Create availability period"}
          </h2>
          <button onClick={onClose} className="text-ds-muted hover:text-ds-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-ds-muted">
          Defines the scheduling period workers submit availability for.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start" type="date" value={startDate} onChange={setStartDate} />
          <Field label="Period end"   type="date" value={endDate}   onChange={setEndDate} />
          <Field label="Availability deadline" type="date" value={availDeadline}    onChange={setAvailDeadline} />
          <Field label="Publish deadline"      type="date" value={publishDeadline}  onChange={setPublishDeadline} />
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose}
            className="rounded-md border border-ds-border px-4 py-2 text-xs font-semibold
              text-ds-muted hover:text-ds-foreground">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="rounded-md bg-ds-accent px-4 py-2 text-xs font-bold
              text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60">
            {saving ? "Saving…" : existing ? "Save changes" : "Create period"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Wire modal into ScheduleApp: import SchedulePeriodModal, render it with
`open={showPeriodModal}` and `onSaved={() => { setShowPeriodModal(false); void reloadPeriod(); }}`.

Commit: `feat(schedule): period management UI — create/edit period + status bar`

---

## GAP 2 — Guided onboarding for supervisors + XP link for workers

### Problem
Fresh accounts hit an empty dashboard with no guidance.
The existing onboarding system has 4 admin steps — none are schedule-specific.
Workers get a modal tour but no connection to their first XP gain.

### What exists (do NOT recreate)
- AdminOnboardingChecklist — renders for company_admin users on dashboard
- NonAdminOnboardingModal — renders for workers/supervisors as a modal tour
- onboarding_service.py — try_mark_onboarding_step(), 4 current step keys
- onboarding_reality.py — auto-detects completion from DB state

### Fix A — Add schedule steps to the admin checklist

=== MODIFY: backend/app/services/onboarding_service.py ===
ACTION: extend ADMIN_CHECKLIST_KEYS with schedule setup steps

```python
# FIND:
ADMIN_CHECKLIST_KEYS: tuple[str, ...] = (
    "create_work_order",
    "add_equipment",
    "invite_team",
    "customize_workflow",
)

# REPLACE WITH:
ADMIN_CHECKLIST_KEYS: tuple[str, ...] = (
    "create_work_order",
    "add_equipment",
    "invite_team",
    "customize_workflow",
    "create_shift_definitions",
    "create_schedule_period",
    "publish_first_schedule",
)
```

Add to STEP_LABELS:
```python
"create_shift_definitions": "Define your shifts",
"create_schedule_period":   "Open availability collection",
"publish_first_schedule":   "Publish your first schedule",
```

Add to STEP_DESCRIPTIONS:
```python
"create_shift_definitions": "Set up shift codes (D1, PM1, N1) with times and cert requirements.",
"create_schedule_period":   "Create a period so workers can submit their availability.",
"publish_first_schedule":   "Build and publish a schedule — workers will be notified automatically.",
```

Add to STEP_HREFS:
```python
"create_shift_definitions": "/schedule/shift-definitions",
"create_schedule_period":   "/schedule",
"publish_first_schedule":   "/schedule",
```

Add ALL_ONBOARDING_STEP_KEYS update:
```python
ALL_ONBOARDING_STEP_KEYS: tuple[str, ...] = ADMIN_CHECKLIST_KEYS
ONBOARDING_STEP_KEYS: tuple[str, ...] = ALL_ONBOARDING_STEP_KEYS
```

### Fix B — Auto-mark new steps when actions happen

=== MODIFY: backend/app/modules/pulse/router.py ===
ACTION: mark onboarding steps when shift definitions and periods are created

After successful shift definition creation (POST /schedule/shift-definitions):
```python
from app.services.onboarding_service import try_mark_onboarding_step
await try_mark_onboarding_step(db, str(user.id), "create_shift_definitions")
```

After successful period creation (POST /schedule/periods):
```python
await try_mark_onboarding_step(db, str(user.id), "create_schedule_period")
```

After successful publish (POST /schedule/publish):
```python
await try_mark_onboarding_step(db, str(user.id), "publish_first_schedule")
```

### Fix C — Add schedule steps to onboarding_reality.py

=== MODIFY: backend/app/services/onboarding_reality.py ===
ACTION: auto-detect schedule completion from DB state

```python
# In load_onboarding_reality(), add:
from app.models.pulse_models import PulseScheduleShiftDefinition, PulseSchedulePeriod, PulseScheduleShift

# Check if shift definitions exist
shift_def_count_q = await db.execute(
    select(func.count()).select_from(PulseScheduleShiftDefinition)
    .where(PulseScheduleShiftDefinition.company_id == str(company_id))
)
reality.shift_definitions_created = int(shift_def_count_q.scalar_one() or 0) > 0

# Check if any period exists
period_q = await db.execute(
    select(func.count()).select_from(PulseSchedulePeriod)
    .where(PulseSchedulePeriod.company_id == str(company_id))
)
reality.period_created = int(period_q.scalar_one() or 0) > 0

# Check if any published shift exists
published_q = await db.execute(
    select(func.count()).select_from(PulseScheduleShift)
    .where(
        PulseScheduleShift.company_id == str(company_id),
        PulseScheduleShift.is_draft.is_(False),
    )
)
reality.schedule_published = int(published_q.scalar_one() or 0) > 0
```

Then in the step merge section add:
```python
m["create_shift_definitions"] = m["create_shift_definitions"] or reality.shift_definitions_created
m["create_schedule_period"]   = m["create_schedule_period"]   or reality.period_created
m["publish_first_schedule"]   = m["publish_first_schedule"]   or reality.schedule_published
```

Use TODO if PulseScheduleShiftDefinition model name differs — check pulse_models.py first.

### Fix D — Link worker onboarding to first XP gain

=== MODIFY: backend/app/services/xp_event_subscribers.py ===
ACTION: mark worker onboarding tour complete when first XP is granted

In `try_grant_xp()` (or in the `_on_task_completed` subscriber), after a
successful XP grant for a worker, check if their onboarding tour is complete:

```python
# After successful XP grant in any subscriber:
# If this is the worker's first XP (total_xp was 0 before this grant):
if prev_total_xp == 0:
    from app.services.onboarding_service import try_mark_onboarding_step
    await try_mark_onboarding_step(db, str(worker_id), "first_xp_earned")
```

Add "first_xp_earned" to ADMIN_CHECKLIST_KEYS only if the worker role is
non-admin. For workers, this closes their onboarding modal.

Actually — simpler approach: in `xp_grant.py`, after updating UserStats,
if `stats.total_xp > 0` and `user.user_onboarding_tour_completed == False`:
```python
if not u.user_onboarding_tour_completed:
    u.user_onboarding_tour_completed = True
    # This dismisses the NonAdminOnboardingModal for workers
```

This means a worker's "getting started" modal auto-dismisses on first XP gain —
a natural milestone that confirms they've actually done something in the app.

Commit: `feat(onboarding): schedule setup steps, auto-mark from reality, worker XP link`

---

## GAP 3 — Worker sees their assignments in My Shifts

### Problem
Assignments exist in `pulse_schedule_assignments` but workers can only see
them in the Day view (supervisor-facing). Tapping a shift in My Shifts shows
no assignments.

### Fix

=== MODIFY: frontend/components/schedule/ScheduleMyShiftsView.tsx ===
ACTION: load and show assignments when a shift is tapped

Add shift detail panel (inline expansion or bottom sheet):

```tsx
const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
const [assignments, setAssignments] = useState<Record<string, AssignmentRow[]>>({});

const loadAssignments = async (shift: Shift) => {
  if (assignments[shift.id]) return; // already loaded
  const dateStr = shift.date; // YYYY-MM-DD
  const url = effectiveCompanyId
    ? `/api/v1/pulse/schedule/assignments?from=${dateStr}&to=${dateStr}&shift_type=${shift.shiftType}&company_id=${effectiveCompanyId}`
    : `/api/v1/pulse/schedule/assignments?from=${dateStr}&to=${dateStr}&shift_type=${shift.shiftType}`;
  try {
    const rows = await apiFetch<AssignmentRow[]>(url);
    setAssignments(prev => ({ ...prev, [shift.id]: rows }));
  } catch { /* non-fatal */ }
};

// On shift row tap:
onPress={() => {
  setExpandedShiftId(id => id === shift.id ? null : shift.id);
  void loadAssignments(shift);
}}
```

When `expandedShiftId === shift.id`, show below the shift row:

```tsx
{expandedShiftId === shift.id && (
  <div className="mt-2 ml-4 space-y-1.5 border-l-2 border-ds-accent/30 pl-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">
      Your assignments
    </p>
    {(assignments[shift.id] ?? []).length === 0 ? (
      <p className="text-xs text-ds-muted">No assignments yet for this shift.</p>
    ) : (assignments[shift.id] ?? []).map(a => (
      <div key={a.id} className="text-xs text-ds-foreground">
        <span className="font-semibold">{a.area}</span>
        {a.notes && <span className="text-ds-muted"> — {a.notes}</span>}
      </div>
    ))}
  </div>
)}
```

Type needed:
```tsx
type AssignmentRow = {
  id: string; area: string; notes: string | null;
  assigned_user_id: string | null; shift_type: string;
};
```

Commit: `feat(schedule): worker sees assignments in My Shifts detail`

---

## GAP 4 — Tools empty state on Home

### Problem
The tools card on the Home dashboard is blank when no beacons are connected.
Workers don't know why or what to do.

### Fix

=== MODIFY: MobileApp/components/dashboard/DashboardScreen.tsx ===
ACTION: tools card shows a helpful empty state

Find the tools card section. When `tools.length === 0`, replace blank space with:

```tsx
{tools.length === 0 ? (
  <View style={{
    paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10,
  }}>
    <View style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: colors.muted, opacity: 0.4,
    }} />
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        No tools tracked yet
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, opacity: 0.7 }}>
        BLE beacons will appear here once connected
      </Text>
    </View>
  </View>
) : (
  // existing tools list
)}
```

Also on the web dashboard `ToolEquipmentTrackingSection` or wherever the
tools card renders with no data — same pattern:

=== MODIFY: frontend/components/pulse/ToolEquipmentTrackingSection.tsx ===
ACTION: add empty state when no beacons are active

Find where the map/beacon list renders. When `beacons.length === 0`:
```tsx
<div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
  <Bluetooth className="h-6 w-6 text-ds-muted/40" />
  <p className="text-sm font-semibold text-ds-foreground">No beacons connected</p>
  <p className="text-xs text-ds-muted max-w-xs">
    BLE location tags will appear here once paired in{" "}
    <a href="/devices" className="text-ds-accent underline">Zones &amp; Devices</a>.
  </p>
</div>
```

Commit: `fix(ux): helpful empty states for tools card on web and mobile`

---

## GAP 5 — Profile zero state on web + mobile

### Problem
New workers see an empty Profile page — zero XP, no badges, no certs.
No encouragement to do their first task.

### Fix

=== MODIFY: frontend/components/settings/SettingsApp.tsx ===
(or wherever the worker-facing profile/gamification display lives on web)

ACTION: when total_xp === 0, show a first task prompt instead of empty stats

```tsx
{gamification && gamification.total_xp === 0 ? (
  <div className="rounded-md border border-ds-border bg-ds-secondary px-5 py-6 text-center space-y-3">
    <p className="text-2xl">🏁</p>
    <p className="text-sm font-bold text-ds-foreground">You're just getting started</p>
    <p className="text-xs text-ds-muted max-w-xs mx-auto leading-relaxed">
      Complete your first task to earn XP and start building your streak.
      Your stats will appear here.
    </p>
    <a href="/(tabs)/tasks" className="inline-flex items-center gap-1.5 rounded-md
      bg-ds-accent px-4 py-2 text-xs font-bold text-ds-accent-foreground
      hover:bg-ds-accent/90">
      View my tasks →
    </a>
  </div>
) : (
  // existing XP/level/badge display
)}
```

=== MODIFY: MobileApp/app/(tabs)/profile.tsx ===
ACTION: same zero state on mobile

When `gamification?.total_xp === 0` or `gamification === null`, show:

```tsx
{(!gamification || gamification.total_xp === 0) && (
  <View style={{
    backgroundColor: colors.card, borderColor: colors.border,
    borderWidth: 1, borderRadius: radii.lg, padding: spacing.xl,
    alignItems: "center", gap: spacing.md,
  }}>
    <Text style={{ fontSize: 36 }}>🏁</Text>
    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, textAlign: "center" }}>
      You're just getting started
    </Text>
    <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
      Complete your first task to earn XP and start your streak.
      Your stats will appear here.
    </Text>
    <Pressable
      onPress={() => router.push("/(tabs)/tasks" as never)}
      style={{
        backgroundColor: colors.success, borderRadius: radii.lg,
        paddingVertical: 12, paddingHorizontal: 24,
      }}
    >
      <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>View my tasks →</Text>
    </Pressable>
  </View>
)}
```

Show this instead of (not alongside) the XP card when XP is zero.
Once the worker earns XP, the normal gamification card renders.

Commit: `fix(ux): profile zero state with first task prompt on web and mobile`

---

## EXECUTION ORDER
1. GAP 1 — Period modal + status bar → commit
2. GAP 2 — Onboarding schedule steps + XP link → commit
3. GAP 3 — Worker assignments in My Shifts → commit
4. GAP 4 — Tools empty states → commit
5. GAP 5 — Profile zero state → commit
6. cd frontend && npm run build
7. git push origin main

---

## VALIDATION
- [ ] Schedule toolbar shows period status bar for managers
- [ ] "Create period" opens a modal with start/end/deadlines
- [ ] Saving creates a period via POST /api/v1/pulse/schedule/periods
- [ ] AdminOnboardingChecklist shows 7 steps (4 existing + 3 schedule)
- [ ] Creating first shift definition marks "create_shift_definitions" complete
- [ ] Creating first period marks "create_schedule_period" complete
- [ ] Publishing marks "publish_first_schedule" complete
- [ ] Worker's onboarding modal auto-dismisses on first XP gain
- [ ] Tapping a shift in My Shifts expands to show assignments
- [ ] Empty assignments shows "No assignments yet"
- [ ] Tools card on mobile shows helpful empty state (not blank)
- [ ] Tools card on web shows empty state with link to Zones & Devices
- [ ] Profile on mobile shows zero state when XP is 0
- [ ] Profile zero state has working "View my tasks →" button
- [ ] npm run build passes

---

## UPDATE handoff/current_state.md
- Add: Period management UI for supervisors
- Add: Onboarding extended with schedule steps (7 total), XP-linked worker modal dismiss
- Add: Worker sees assignments in My Shifts on tap
- Add: Tools and profile zero/empty states
- Update Last Updated
git add handoff/current_state.md
git commit -m "chore: update current_state after 5 gap fixes"
