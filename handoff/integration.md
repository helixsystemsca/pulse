# Settings + Live Map Design System Fix — integration.md

## CURSOR PROMPT
"Read handoff/integration.md. Execute all steps in order.
Modify existing files only — do not create new ones unless specified.
Commit at end with the message provided."

---

## WHAT TO MATCH
The Equipment page is the reference. Key patterns to copy exactly:
- PageHeader component with icon, title, description
- Nav tabs: `flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1`
- Active tab: `border-b-2 border-ds-success bg-ds-primary text-ds-foreground`
- Inactive tab: `border-b-2 border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground`
- Page wrapper: `space-y-6`
- Auth guard: same readSession() + navigateToPulseLogin() pattern as equipment/page.tsx
- No custom dark backgrounds, no hardcoded colors — use ds-* tokens only

---

=== MODIFY: frontend/app/live-map/page.tsx ===
ACTION: replace entire file

"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnifiedFacilityMap } from "@/components/pulse/UnifiedFacilityMap";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

type Tab = "live" | "demo";

export default function LiveMapPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("live");

  useEffect(() => {
    const s = readSession();
    if (!s) { navigateToPulseLogin(); return; }
    if (isApiMode() && !s.access_token) { navigateToPulseLogin(); return; }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        tab === id
          ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
          : "border-b-2 border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Map"
        description="Real-time beacon positions across your facility."
        icon={Radio}
      />

      <nav
        className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
        aria-label="Live map sections"
      >
        {tabBtn("live", "Live Hardware")}
        {tabBtn("demo", "Demo Scenario")}
      </nav>

      {tab === "live" && (
        <div className="space-y-4">
          <p className="text-sm text-ds-muted">
            Showing live beacon positions from connected ESP32 gateways.
            Connect hardware and positions will appear automatically.{" "}
            <button
              type="button"
              onClick={() => setTab("demo")}
              className="ds-link font-semibold"
            >
              No hardware yet? Try the Demo Scenario.
            </button>
          </p>
          <UnifiedFacilityMap pollMs={3000} />
        </div>
      )}

      {tab === "demo" && (
        <div className="space-y-4">
          <p className="text-sm text-ds-muted">
            Simulates the full inference pipeline — Daniel approaches the Hot Tub Boiler,
            confidence builds, and a confirmation prompt fires at 90%.
            Press <span className="font-semibold text-ds-foreground">Start Demo</span> to run.
          </p>
          <UnifiedFacilityMap demoMode showControls pollMs={1000} />
        </div>
      )}
    </div>
  );
}


---

=== MODIFY: frontend/components/settings/SettingsApp.tsx ===
ACTION: 4 targeted changes to match app design system

CHANGE 1 — Add PageHeader import at top of file:
FIND:   import {
          Activity,
REPLACE WITH (add to the existing import block):
Add this import line near the top:
  import { PageHeader } from "@/components/ui/PageHeader";
Also add Settings icon to the lucide imports if not already there.

CHANGE 2 — Replace the custom header div with PageHeader component.
FIND the header section that looks like:
```tsx
<div className="border-b border-ds-border bg-ds-primary px-6 py-5">
  <div className="max-w-5xl mx-auto flex items-center gap-3">
    <Settings className="h-5 w-5 text-ds-accent" />
    <div>
      <h1 className="text-base font-bold text-ds-foreground">Settings</h1>
      <p className="text-xs text-ds-muted mt-0.5">Configure Pulse for your facility</p>
    </div>
  </div>
</div>
```
REPLACE WITH:
```tsx
<PageHeader
  title="Settings"
  description="Configure Pulse for your facility."
  icon={Settings}
/>
```

CHANGE 3 — Replace sidebar nav with horizontal tab nav matching equipment pattern.
FIND the sidebar nav block (the `<nav className="w-48 shrink-0">` element and its ul/li children).
REPLACE the entire sidebar + content grid layout with a flat top-nav layout:

```tsx
<nav
  className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
  aria-label="Settings sections"
>
  {TABS.map(tab => (
    <button
      key={tab.id}
      type="button"
      onClick={() => switchTab(tab.id)}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        activeTab === tab.id
          ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
          : "border-b-2 border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground"
      }`}
    >
      {tab.icon}
      {tab.label}
    </button>
  ))}
</nav>
```

CHANGE 4 — Remove the outer min-h-screen bg-ds-bg wrapper div and max-w-5xl padding.
The page already gets padding from the app shell. Replace:
```tsx
<div className="min-h-screen bg-ds-bg">
  ...
  <div className="max-w-5xl mx-auto px-6 py-6 flex gap-6">
    <nav className="w-48 shrink-0">...</nav>
    <div className="flex-1 min-w-0">
      {content}
    </div>
  </div>
</div>
```
WITH:
```tsx
<div className="space-y-6">
  <PageHeader title="Settings" description="Configure Pulse for your facility." icon={Settings} />
  <nav ...>  {/* tab nav from Change 3 */}
  </nav>
  <div>
    {content}  {/* same tab content panels, unchanged */}
  </div>
</div>
```

---

=== MODIFY: frontend/app/settings/page.tsx ===
ACTION: match equipment page auth guard pattern exactly

Replace entire file with:

"use client";

import { Suspense } from "react";
import { SettingsApp } from "@/components/settings/SettingsApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) { navigateToPulseLogin(); return; }
    if (isApiMode() && !s.access_token) { navigateToPulseLogin(); return; }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ds-success border-t-transparent" />
      </div>
    }>
      <SettingsApp />
    </Suspense>
  );
}

---

## EXECUTION STEPS
1. Replace frontend/app/live-map/page.tsx entirely
2. Modify frontend/components/settings/SettingsApp.tsx — 4 changes
3. Replace frontend/app/settings/page.tsx entirely
4. git add -A && git commit -m "fix: align settings and live map pages with app design system"
5. git push origin main

---

## VALIDATION
- [ ] Live Map header matches Equipment header (icon + title + description)
- [ ] Live Map tabs match Equipment tabs (same rounded pill nav style)
- [ ] Live Map background is white/ds-bg not dark
- [ ] Settings header matches Equipment header
- [ ] Settings uses horizontal tab nav not sidebar
- [ ] Settings background is white/ds-bg not dark
- [ ] Both pages pass Vercel build
- [ ] useSearchParams Suspense boundary still present in settings
