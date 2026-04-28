# Mobile Polish — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and handoff/contracts.md.
Option A — native screens. No WebViews.
Execute steps in order. Check before creating.
Run cd frontend && npm run build on web changes.
Commit after each phase with message provided."

---

## CONTEXT
All 6 tabs exist. The structure is correct.
Goal: make each tab genuinely useful for a field worker's daily flow.
Do not rebuild screens that already work — polish and wire missing pieces.

---

## PHASE 1 — Home tab polish

### 1A — Shift card shows correct state [ ]
CHECK:
```bash
grep -n "On shift\|Upcoming\|No shift\|starts_at\|ends_at" MobileApp/components/dashboard/DashboardScreen.tsx | head -10
```

The shift card should show one of three states:
- **On shift now** — if current time is between starts_at and ends_at → green dot, "On shift now"
- **Next shift** — upcoming shift → show date + time
- **No shifts** — no upcoming shifts → "No upcoming shifts scheduled"

Fix the shift card logic:
```tsx
const now = Date.now();
const currentShift = upcomingShifts.find(s =>
  new Date(s.starts_at).getTime() <= now &&
  new Date(s.ends_at).getTime() >= now
);
const nextShift = upcomingShifts.find(s =>
  new Date(s.starts_at).getTime() > now
);
const activeShift = currentShift ?? nextShift ?? null;
```
Show "On shift now" with pulsing green dot if currentShift exists.
Show "Next shift" with date/time if nextShift exists but currentShift doesn't.

### 1B — Tasks card shows priority correctly [ ]
CHECK:
```bash
grep -n "priority\|overdue\|due_date" MobileApp/components/dashboard/DashboardScreen.tsx | head -10
```
Tasks on the home card should show:
- Overdue tasks first (due_date < now), flagged in red
- Critical tasks next
- Max 3 tasks shown, with "View all →" below

If not already sorted this way, sort before slicing:
```tsx
const sorted = tasks.sort((a, b) => {
  const aOver = a.due_date && new Date(a.due_date) < new Date() ? -1 : 0;
  const bOver = b.due_date && new Date(b.due_date) < new Date() ? -1 : 0;
  if (aOver !== bOver) return aOver - bOver;
  const pri = { critical: 0, high: 1, medium: 2, low: 3 };
  return (pri[a.priority] ?? 2) - (pri[b.priority] ?? 2);
});
```

### 1C — Quick actions row [ ]
CHECK:
```bash
grep -n "Quick\|quick.*action\|scan\|QR\|Log.*work\|New.*WR" MobileApp/components/dashboard/DashboardScreen.tsx | head -5
```
EXPECTED: Below the greeting, a row of quick action buttons:
- "+ Log issue" → navigates to /new-work-request
- "📋 My tasks" → navigates to /(tabs)/tasks
- "🔍 Find tool" → navigates to /(tabs)/search with q pre-filled

IF MISSING: Add above the shift card:
```tsx
<View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.md }}>
  {[
    { label: "+ Log issue", to: "/new-work-request" },
    { label: "My tasks",    to: "/(tabs)/tasks" },
    { label: "Find tool",   to: "/(tabs)/search" },
  ].map(a => (
    <Pressable key={a.label} onPress={() => router.push(a.to as never)}
      style={{
        flex: 1, paddingVertical: 10, borderRadius: radii.lg,
        backgroundColor: colors.surface, borderWidth: 1,
        borderColor: colors.border, alignItems: "center",
      }}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
        {a.label}
      </Text>
    </Pressable>
  ))}
</View>
```

Commit: `polish(mobile/home): shift state logic, priority sorting, quick actions`

---

## PHASE 2 — Tasks tab polish

### 2A — Task detail screen [ ]
CHECK:
```bash
find MobileApp/app -name "task-detail*"
grep -n "task.id\|task_id\|TaskDetail" "MobileApp/app/(tabs)/tasks.tsx" | head -5
```
EXPECTED: Tapping a task navigates to a detail screen showing:
- Title, description, priority badge
- Due date with overdue warning
- Status update buttons: Start / Complete
- Notes input

IF task-detail.tsx is missing or stub-only, replace with:
```tsx
// MobileApp/app/task-detail.tsx
// GET /api/v1/tasks/{id}/full (or /api/v1/gamification/tasks/{id}/full)
// Shows: title, description, priority, due, status
// Buttons: "Start working" → PATCH status to in_progress
//          "Mark complete" → POST /api/v1/gamification/tasks/{id}/complete
// On complete: show XP toast from response (xp, xp_breakdown)
// After complete: go back to tasks list
```

### 2B — XP toast on task completion [ ]
CHECK:
```bash
grep -n "xp.*toast\|toast.*xp\|xp_awarded\|CompleteTask" "MobileApp/app/(tabs)/tasks.tsx" MobileApp/app/task-detail.tsx 2>/dev/null | head -10
```
EXPECTED: When `POST /tasks/{id}/complete` returns, show a brief XP notification:
"+48 XP  · +6 steps · +4 photo" for 2 seconds at bottom of screen.

IF MISSING: After successful complete call, show:
```tsx
// Simple toast — no library needed
const [xpToast, setXpToast] = useState<string | null>(null);

// After complete:
const breakdown = result.xp_breakdown ?? {};
const parts = Object.entries(breakdown)
  .filter(([k, v]) => k !== "base" && v > 0)
  .map(([k, v]) => `+${v} ${k}`);
const msg = `+${result.xp} XP${parts.length ? "  ·  " + parts.join("  ·  ") : ""}`;
setXpToast(msg);
setTimeout(() => setXpToast(null), 2500);

// Render at bottom of screen (absolute positioned):
{xpToast && (
  <View style={{
    position: "absolute", bottom: 100, left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.success, borderRadius: radii.lg,
    padding: spacing.md, alignItems: "center",
  }}>
    <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{xpToast}</Text>
  </View>
)}
```

Commit: `polish(mobile/tasks): task detail screen, XP toast on completion`

---

## PHASE 3 — Schedule tab polish

### 3A — My Shifts tab is the default [ ]
CHECK:
```bash
grep -n "defaultTab\|initialTab\|useState.*tab\|my.shift\|MyShift" "MobileApp/app/(tabs)/schedule.tsx" | head -10
```
EXPECTED: Schedule tab opens to "My Shifts" by default, not the full team schedule.
Workers should see their own shifts first.

IF OPENING TO WRONG TAB: Change the initial tab state to "my-shifts" or "mine".

### 3B — Shift detail on tap [ ]
CHECK:
```bash
grep -n "onPress.*shift\|shift.*onPress\|ShiftDetail\|shift-detail" "MobileApp/app/(tabs)/schedule.tsx" | head -10
```
EXPECTED: Tapping a shift in My Shifts shows:
- Date, time, shift code
- Zone/facility
- Crew members on same shift (if available)
- Assignments for that shift

IF TAP DOES NOTHING: Add navigation to a shift detail modal or screen.
Minimal implementation — show a bottom sheet or navigate to `/shift-detail`:
```tsx
// Basic shift detail as a modal using React Native Modal
// Shows: shift time, code, assignments from pulse_schedule_assignments
// GET /api/v1/pulse/schedule/assignments?from=shift_date&to=shift_date&shift_type=
```

### 3C — Acknowledgement banner [ ]
CHECK:
```bash
grep -n "acknowledge\|Acknowledge" "MobileApp/app/(tabs)/schedule.tsx" | head -5
```
EXPECTED: When a schedule is published and not yet acknowledged, show a banner
at the top of My Shifts: "📋 Tap to acknowledge your schedule"
On tap → POST /api/v1/pulse/schedule/acknowledge → banner becomes "✓ Acknowledged"

IF MISSING: Wire the acknowledgement status check and banner from M6integration.md.

Commit: `polish(mobile/schedule): my shifts default, shift detail, acknowledgement banner`

---

## PHASE 4 — Documents tab polish

### 4A — Procedure step runner [ ]
CHECK:
```bash
find MobileApp/app -name "procedure-assignment*"
grep -n "step\|Step\|checklist\|complete.*step" MobileApp/app/procedure-assignment.tsx 2>/dev/null | head -10
```
EXPECTED: `procedure-assignment.tsx` shows steps one at a time:
- Large step number
- Step content/instruction
- Checkbox or "Done" button per step
- Progress indicator (step 3 of 8)
- "Complete procedure" button when all steps done
- Completion fires `ops.procedure_completed` domain event via API

IF STUB ONLY: The procedure-assignment screen needs step-by-step UX.
This is the worker's most important document interaction.
Add step navigation with Prev/Next buttons and a completion flow.

### 4B — Blueprint viewer accessible [ ]
CHECK:
```bash
find MobileApp/app -name "blueprint*"
grep -n "blueprint\|Blueprint" "MobileApp/app/(tabs)/documents.tsx" | head -5
```
EXPECTED: Tapping a drawing in Documents opens `blueprint.tsx` (or similar).
Blueprint renders the saved drawing in read-only mode.

IF NOT WIRED: Ensure the Drawings tab row navigates to the blueprint viewer.

Commit: `polish(mobile/documents): procedure step runner, blueprint navigation`

---

## PHASE 5 — Search tab polish

### 5A — Tool location result [ ]
CHECK:
```bash
grep -n "x_norm\|y_norm\|zone.*name\|last_seen_zone\|location" MobileApp/lib/api/search.ts 2>/dev/null | head -10
grep -n "zone_id\|zone.*label\|location.*label" "MobileApp/app/(tabs)/search.tsx" | head -10
```
EXPECTED: When a tool appears in search results, the subtitle shows its last known zone name.
Tool cards show: name | zone name | time ago

IF SHOWING RAW ZONE_ID: Resolve zone name from the search result meta.
The backend search result already has `meta.zone_id` and `meta.last_seen_at`.
Add zone name resolution:
- Either include zone_name in the search result from backend (preferred)
- Or load zones once and resolve client-side

Add to search_routes.py tool result:
```python
# In the tool search section, join BeaconPosition to Zone
# Add to meta: "zone_name": zone.name if zone else None
```

### 5B — Empty state is helpful [ ]
CHECK:
```bash
grep -n "No results\|empty\|nothing found\|Quick find" "MobileApp/app/(tabs)/search.tsx" | head -5
```
EXPECTED: Empty state (no query) shows quick find chips:
- "My Tools", "Equipment", "Procedures"
These pre-fill the search box and trigger a search.

IF MISSING OR PLACEHOLDER: Wire quick find buttons to set query and trigger search.

Commit: `polish(mobile/search): tool zone names in results, quick find chips`

---

## PHASE 6 — Profile tab polish

### 6A — Gamification data loads [ ]
CHECK:
```bash
grep -n "getMyGamification\|gamification\|total_xp\|leaderboard" "MobileApp/app/(tabs)/profile.tsx" | head -10
```
EXPECTED: Profile loads from `/api/v1/workers/{userId}/gamification` or
`/api/v1/gamification/me`. Shows XP, level, progress bar, badges, streak.

IF SHOWING ZEROS OR FAILING: Check the endpoint exists on backend (Phase F audit).
Ensure the fallback to `/api/v1/users/{id}/analytics` works if primary fails.

### 6B — Certifications show labels not codes [ ]
CHECK:
```bash
grep -n "cert\|Cert\|certification" "MobileApp/app/(tabs)/profile.tsx" | head -10
```
EXPECTED: Certs show human labels ("Pool Operator 2") not raw codes ("P2").
IF SHOWING RAW CODES: The cert definitions come from pulse_config.
For now, use a hardcoded label map as fallback:
```ts
const CERT_LABELS: Record<string, string> = {
  P1: "Pool Operator 1", P2: "Pool Operator 2",
  RO: "Refrigeration Operator", FA: "First Aid",
};
// label = CERT_LABELS[cert.code] ?? cert.code
```
Mark with TODO to fetch from pulse_config when cert definitions are migrated.

### 6C — Settings rows navigate correctly [ ]
CHECK:
```bash
grep -n "Notifications\|Availability\|Theme\|onPress.*settings" "MobileApp/app/(tabs)/profile.tsx" | head -10
```
EXPECTED:
- "Availability" → navigates to schedule tab availability section
- "Notifications" → navigates to notification settings (stub screen ok)
- "Theme" → toggles dark/light mode using existing theme system

IF ANY ROW DOES NOTHING: Wire navigation or add stub screens.

Commit: `polish(mobile/profile): gamification data, cert labels, settings navigation`

---

## EXECUTION ORDER
1. Phase 1 (Home) → commit
2. Phase 2 (Tasks) → commit
3. Phase 3 (Schedule) → commit
4. Phase 4 (Documents) → commit
5. Phase 5 (Search) → commit
6. Phase 6 (Profile) → commit
7. git push origin main

---

## VALIDATION
- [ ] Home: shift shows "On shift now" / "Next shift" / "No shifts" correctly
- [ ] Home: tasks sorted by overdue then priority
- [ ] Home: quick action row visible
- [ ] Tasks: tapping a task opens detail screen
- [ ] Tasks: completing a task shows XP toast with breakdown
- [ ] Schedule: opens to My Shifts by default
- [ ] Schedule: tapping a shift shows shift detail
- [ ] Schedule: acknowledgement banner shows when unacknowledged
- [ ] Documents: procedures show step-by-step runner
- [ ] Documents: drawings tap opens blueprint viewer
- [ ] Search: tool results show zone name not raw ID
- [ ] Search: quick find chips work
- [ ] Profile: XP and level load from API
- [ ] Profile: cert labels are human-readable
- [ ] Profile: settings rows navigate correctly

---

## UPDATE handoff/current_state.md
- Add: Mobile polish pass complete — all 6 tabs have real content and navigation
- Note any screens that remain stub with reason
- Update Last Updated
git add handoff/current_state.md
git commit -m "chore: update current_state after mobile polish pass"
