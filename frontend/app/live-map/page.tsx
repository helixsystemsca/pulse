"use client";

import { Suspense, useState } from "react";
import { DemoLiveMap } from "@/components/demo/DemoLiveMap";
import { LiveFacilityMap } from "@/components/pulse/LiveFacilityMap";

export default function LiveMapPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
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
          <LiveFacilityMap pollMs={3000} />
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
          <DemoLiveMap />
        </div>
      )}

    </div>
  );
}
