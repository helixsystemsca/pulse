"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LiveFacilityMap } from "@/components/pulse/LiveFacilityMap";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

type Tab = "live" | "demo";

export default function LiveMapPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("live");

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && !s.access_token) {
      navigateToPulseLogin();
      return;
    }
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
      <PageHeader title="Live Map" description="Real-time beacon positions across your facility." icon={Radio} />

      <nav className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1" aria-label="Live map sections">
        {tabBtn("live", "Live Hardware")}
        {tabBtn("demo", "Demo Scenario")}
      </nav>

      {tab === "live" && (
        <div className="space-y-4">
          <p className="text-sm text-ds-muted">
            Showing live beacon positions from connected ESP32 gateways. Connect hardware and positions will appear
            automatically.{" "}
            <button type="button" onClick={() => setTab("demo")} className="ds-link font-semibold">
              No hardware yet? Try the Demo Scenario.
            </button>
          </p>
          <LiveFacilityMap pollMs={3000} />
        </div>
      )}

      {tab === "demo" && (
        <div className="space-y-4">
          <p className="text-sm text-ds-muted">
            Simulates the full inference pipeline — Daniel approaches the Hot Tub Boiler, confidence builds, and a
            confirmation prompt fires at 90%. Press{" "}
            <span className="font-semibold text-ds-foreground">Start Demo</span> to run.
          </p>
          <LiveFacilityMap demoMode showControls pollMs={1000} />
        </div>
      )}
    </div>
  );
}
