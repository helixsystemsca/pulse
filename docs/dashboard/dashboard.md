
You are refactoring a React + Tailwind application to standardize all dashboards using a new **Kiosk Dashboard System**.

You have an HTML layout (from Claude) that represents the desired UI.
Your job is to **translate it into reusable React components**, not paste raw HTML.

---

# 1. CREATE DASHBOARD THEME TOKENS

Create:
`/src/styles/dashboardTheme.ts`

```ts
export const DASHBOARD = {
  page: "bg-gray-50 min-h-screen p-4",
  grid: "grid grid-cols-12 gap-4",

  card: "bg-white rounded-2xl shadow-sm p-4",
  compactCard: "bg-white rounded-xl p-3",

  kpi: "bg-white rounded-xl p-3 flex flex-col",
  kpiValue: "text-2xl font-semibold",
  kpiLabel: "text-xs text-gray-500",

  sectionTitle: "text-sm font-semibold text-gray-600 uppercase tracking-wide",

  avatar: "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200",

  alertCritical: "border-l-4 border-red-500 bg-red-50",
  alertWarning: "border-l-4 border-yellow-500 bg-yellow-50",
  alertInfo: "border-l-4 border-blue-500 bg-blue-50",
};
```

---

# 2. CREATE KIOSK FULLSCREEN HANDLER

Create:
`/src/hooks/useKioskMode.ts`

```ts
export function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
}
```

Use this when user clicks “Fullscreen”.

IMPORTANT:

* Do NOT attempt to hide browser UI beyond fullscreen API
* Remove app nav/sidebar when in kiosk mode

---

# 3. RESTRUCTURE TOP BAR

Refactor top header:

### REMOVE:

* Project Start date

### MERGE:

* Move TODAY date into clock section

### FINAL STRUCTURE:

* Project name
* Status (e.g. “9 days overdue”)
* Completion %
* On-site avatars
* Clock (with date included)

---

# 4. REPLACE ON-SITE USER LIST WITH AVATARS

Create component:

```tsx
function Avatar({ name }) {
  const initials = name.split(" ").map(n => n[0]).join("");
  return <div className={DASHBOARD.avatar}>{initials}</div>;
}
```

Display:

* avatar + first name only
* horizontal layout
* max 5 visible

---

# 5. SIMPLIFY TEAM INSIGHTS

REMOVE:

* detailed user cards
* badges (Rising Star, Fast Closer, etc.)

REPLACE WITH:

Bottom-right KPI strip:

* Total Tasks
* In Progress
* Blocked

---

# 6. SAFETY CARDS (CENTER PANEL)

Keep structure but:

* limit text to 2 lines max
* truncate overflow
* maintain priority styling (critical / caution / info)

---

# 7. LEFT PANEL (ASSIGNMENTS)

Simplify:

* show task name
* show status
* show first name only

REMOVE:

* long descriptions
* full names

---

# 8. DATA WIRING STRATEGY

For all dashboard data:

### If real data exists:

* use API data

### If missing:

* fallback to mock

Example:

```ts
const activeRequests = realData?.activeRequests ?? 7;
```

---

# 9. CREATE MOCK DATA FILE

`/src/mocks/dashboardMock.ts`

```ts
export const dashboardMock = {
  activeRequests: 7,
  overdue: 2,
  lowStock: 3,
  outOfService: 1,
  onSite: ["Brett", "Dan", "Mauro", "Nick"],
  completedToday: 12,
};
```

---

# 10. APPLY LAYOUT USING 12-COLUMN GRID

Structure:

```tsx
<div className={DASHBOARD.page}>
  <div className={DASHBOARD.grid}>

    {/* Top Bar */}
    <div className="col-span-12">...</div>

    {/* Left Assignments */}
    <div className="col-span-3">...</div>

    {/* Center Alerts */}
    <div className="col-span-6">...</div>

    {/* Right KPIs */}
    <div className="col-span-3">...</div>

  </div>
</div>
```

---

# 11. ADD ROTATION SYSTEM (15s)

Reuse existing rotation logic:

* Overview (default)
* Workforce
* Systems

Team insights should ONLY appear in one rotation state.

---

# 12. STANDARDIZE ALL DASHBOARDS

Refactor ALL existing dashboards to:

* use DASHBOARD tokens
* use same grid system
* use same card styles
* remove conflicting Tailwind styles

---

# 13. FULLSCREEN MODE BEHAVIOR

When fullscreen is active:

* hide sidebar/navigation
* hide unnecessary UI controls
* maximize dashboard grid
* increase font sizes slightly

---

# RESULT

* Unified dashboard UI across app
* Clean kiosk-friendly layout
* Reduced clutter
* Real + mock data working seamlessly
* Fullscreen behaves like a control board
