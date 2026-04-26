# Live Map Nav + Demo Fix — integration.md

## CURSOR PROMPT
"Read handoff/integration.md. Execute all steps in order.
Check file exists before creating. Commit at end with message provided."

---

## ROOT CAUSE — Demo stops after 1s
demo_routes.py constructs DomainEvent with `id=` kwarg but DomainEvent
has no `id` field — it uses `correlation_id`. This crashes the asyncio
task on first publish, stopping the scenario immediately.
Fix: remove `id=` from all DomainEvent() calls in demo_routes.py.

---

=== MODIFY: backend/app/api/demo_routes.py ===
ACTION: fix all DomainEvent() calls — remove id= parameter

In _run_scenario() and all other functions, find every DomainEvent() call.
Remove the `id=str(uuid4()),` line from each one.

Correct shape:
```python
DomainEvent(
    company_id=company_id,
    event_type="demo_inference_fired",
    entity_id=DEMO_INFERENCE_ID,
    source_module="demo",
    metadata={ ... },
)
```

There are approximately 4-5 DomainEvent() calls in the file.
Remove `id=...` from ALL of them. Do not change anything else.

---

=== MODIFY: frontend/lib/pulse-app.ts ===
ACTION: add Live Map nav item

FIND:
  { href: "/devices", label: "Zones & Devices", icon: "map-pin" as const },

REPLACE WITH:
  { href: "/devices", label: "Zones & Devices", icon: "map-pin" as const },
  { href: "/live-map", label: "Live Map", icon: "radio" as const },

Also FIND and REMOVE the demo nav item we added previously if it exists:
  { href: "/demo", label: "Live Demo", icon: "radio" as const },

---

=== FILE: frontend/app/live-map/page.tsx ===

"use client";

import { Suspense, useState } from "react";
import { UnifiedFacilityMap } from "@/components/pulse/UnifiedFacilityMap";

export default function LiveMapPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ds-accent border-t-transparent" />
      </div>
    }>
      <LiveMapContent />
    </Suspense>
  );
}

function LiveMapContent() {
  const [tab, setTab] = useState<"live" | "demo">("live");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-ds-foreground">Live Map</h1>
          <p className="text-xs text-ds-muted mt-0.5">
            Real-time beacon positions across your facility
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ds-border gap-0">
        {([
          { id: "live", label: "Live Hardware" },
          { id: "demo", label: "Demo Scenario" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-ds-accent text-ds-accent"
                : "border-transparent text-ds-muted hover:text-ds-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Live tab */}
      {tab === "live" && (
        <div className="space-y-3">
          <div className="rounded-md border border-ds-border bg-ds-primary px-4 py-3 text-xs text-ds-muted leading-relaxed">
            Showing live beacon positions from connected ESP32 gateways.
            Connect hardware and positions will appear automatically.
            <span className="block mt-1 text-ds-muted/70">
              No hardware yet? Switch to the <button onClick={() => setTab("demo")}
                className="text-ds-accent underline">Demo Scenario</button> tab.
            </span>
          </div>
          <UnifiedFacilityMap pollMs={3000} />
        </div>
      )}

      {/* Demo tab */}
      {tab === "demo" && (
        <div className="space-y-3">
          <div className="rounded-md border border-ds-accent/30 bg-ds-accent/5 px-4 py-3 text-xs text-ds-foreground leading-relaxed">
            <span className="font-semibold text-ds-accent block mb-1">Demo Scenario · Pool Zone</span>
            Simulates the full inference pipeline — Daniel approaches the Hot Tub Boiler,
            confidence builds, and a confirmation prompt fires at 90%. Press Start to run.
          </div>
          <UnifiedFacilityMap demoMode showControls pollMs={1000} />
        </div>
      )}

    </div>
  );
}

---

=== MODIFY: frontend/app/demo/page.tsx ===
ACTION: redirect to /live-map?tab=demo instead of rendering its own page

Replace entire file with:

import { redirect } from "next/navigation";
export default function DemoPage() {
  redirect("/live-map");
}

---

## EXECUTION STEPS
1. Fix backend/app/api/demo_routes.py — remove id= from all DomainEvent() calls
2. Modify frontend/lib/pulse-app.ts — replace demo nav with live-map nav
3. Create frontend/app/live-map/page.tsx
4. Replace frontend/app/demo/page.tsx with redirect
5. git add -A && git commit -m "feat: live map page with demo tab, fix demo scenario crash"
6. git push origin main

---

## VALIDATION
- [ ] /live-map loads with Live Hardware + Demo Scenario tabs
- [ ] Demo tab: Start Demo runs for full 120s without stopping
- [ ] Demo tab: inference card fires at ~65s
- [ ] Demo tab: Confirm logs successfully
- [ ] Live Hardware tab: shows empty state when no beacons
- [ ] /demo redirects to /live-map
- [ ] Sidebar shows "Live Map" item
- [ ] Vercel build passes
