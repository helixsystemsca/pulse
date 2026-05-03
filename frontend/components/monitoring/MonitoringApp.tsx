"use client";

import { Activity, ExternalLink, Server } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { pulseAppHref } from "@/lib/pulse-app";

function EmptyMonitoringPanel({ message }: { message: string }) {
  return (
    <Card padding="md" className="border-dashed border-ds-border bg-ds-secondary/30">
      <p className="text-sm text-ds-muted">{message}</p>
    </Card>
  );
}

type MainTab = "systems";

export function MonitoringApp() {
  const [tab, setTab] = useState<MainTab>("systems");

  const tabBtn = (id: MainTab, label: string, Icon: typeof Server) => (
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
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring" description="Real-time visibility into systems" icon={Activity} />

      <nav
        className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
        aria-label="Monitoring sections"
      >
        {tabBtn("systems", "Systems", Server)}
      </nav>

      {tab === "systems" ? (
        <EmptyMonitoringPanel message="No system telemetry here yet. When sensors and controllers are connected, readings will appear in this tab." />
      ) : null}

      <section aria-labelledby="team-insights-callout">
        <Card padding="md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="team-insights-callout" className="font-headline text-base font-bold text-ds-foreground">
                Team Insights
              </h2>
              <p className="mt-1 text-sm text-ds-muted">
                People + XP + streaks live in <span className="font-medium text-ds-foreground">Team Insights</span>.
              </p>
            </div>
            <Link
              href={pulseAppHref("/dashboard/team-insights")}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#4C6085] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#405574]"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open Team Insights
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
