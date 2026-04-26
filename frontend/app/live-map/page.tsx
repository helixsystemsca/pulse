"use client";

import { Radio } from "lucide-react";
import { Suspense, useState } from "react";
import { UnifiedFacilityMap } from "@/components/pulse/UnifiedFacilityMap";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <div className="space-y-6">
      <PageHeader
        title="Live Map"
        description="Real-time beacon positions across your facility."
        icon={Radio}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1">
        {([
          { id: "live", label: "Live Hardware" },
          { id: "demo", label: "Demo Scenario" },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center rounded-lg border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-ds-success bg-ds-primary text-ds-foreground shadow-sm"
                : "border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Live tab */}
      {tab === "live" && (
        <div className="space-y-3">
          <div className="rounded-md border border-ds-border bg-ds-primary px-4 py-3 text-sm leading-relaxed text-ds-muted shadow-[var(--ds-shadow-card)]">
            Showing live beacon positions from connected ESP32 gateways.
            Connect hardware and positions will appear automatically.
            <span className="mt-1 block text-ds-muted/70">
              No hardware yet? Switch to the <button onClick={() => setTab("demo")}
                type="button"
                className="font-semibold text-ds-success underline underline-offset-2">Demo Scenario</button> tab.
            </span>
          </div>
          <UnifiedFacilityMap pollMs={3000} />
        </div>
      )}

      {/* Demo tab */}
      {tab === "demo" && (
        <div className="space-y-3">
          <div className="rounded-md border border-ds-success/30 bg-[color-mix(in_srgb,var(--ds-success)_8%,var(--ds-primary))] px-4 py-3 text-sm leading-relaxed text-ds-foreground shadow-[var(--ds-shadow-card)]">
            <span className="mb-1 block font-semibold text-ds-success">Demo Scenario · Pool Zone</span>
            Simulates the full inference pipeline — Daniel approaches the Hot Tub Boiler,
            confidence builds, and a confirmation prompt fires at 90%. Press Start to run.
          </div>
          <UnifiedFacilityMap demoMode showControls pollMs={1000} />
        </div>
      )}

    </div>
  );
}
