"use client";

import { Activity, Droplets, ExternalLink, Gauge, Server, Thermometer, Wind } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/pulse/Card";
import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { PageHeader } from "@/components/ui/PageHeader";
import { pulseAppHref } from "@/lib/pulse-app";
import { co2Tanks, poolControllers } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";

const CO2_LEVEL_MAX = 1000;

function PoolControllerMockCard({
  name,
  chlorine,
  ph,
  flow,
  temp,
  co2FeederActive,
  chlorineFeederActive,
}: (typeof poolControllers)[number]) {
  return (
    <div className="ds-premium-panel rounded-xl p-4">
      <p className="font-headline text-sm font-bold text-ds-foreground">{name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-ds-muted">
          <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
          <dt className="sr-only">Chlorine</dt>
          <dd>
            <span className="font-semibold text-ds-foreground">{chlorine}</span> ppm Cl
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-ds-muted">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
          <dt className="sr-only">pH</dt>
          <dd>
            <span className="font-semibold text-ds-foreground">{ph}</span> pH
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-ds-muted">
          <Wind className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
          <dt className="sr-only">Flow</dt>
          <dd>
            <span className="font-semibold text-ds-foreground">{flow}</span> GPM
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-ds-muted">
          <Thermometer className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
          <dt className="sr-only">Temperature</dt>
          <dd>
            <span className="font-semibold text-ds-foreground">{temp}</span> °C
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            co2FeederActive ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : "bg-ds-secondary text-ds-muted",
          )}
        >
          CO₂ feeder {co2FeederActive ? "on" : "off"}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            chlorineFeederActive ? "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100" : "bg-ds-secondary text-ds-muted",
          )}
        >
          Chlorine feeder {chlorineFeederActive ? "on" : "off"}
        </span>
      </div>
    </div>
  );
}

function SystemsMockMonitoringPanel() {
  return (
    <div className="space-y-6">
      <Card padding="md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-base font-bold text-ds-foreground">CO₂ tanks</h2>
            <p className="mt-1 max-w-2xl text-sm text-ds-muted">
              Demo fill levels on a 0–{CO2_LEVEL_MAX} sensor scale. Live hardware will replace this preview when telemetry is
              connected.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-center gap-x-10 gap-y-10 sm:gap-x-14 md:gap-x-16">
          {co2Tanks.map((t) => (
            <TankIndicator key={t.id} label={t.name} value={t.level} max={CO2_LEVEL_MAX} sublabel={t.location} />
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h2 className="font-headline text-base font-bold text-ds-foreground">Pool controllers</h2>
        <p className="mt-1 text-sm text-ds-muted">Demo chemistry, flow, and feeder status for the same facility.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {poolControllers.map((c) => (
            <PoolControllerMockCard key={c.id} {...c} />
          ))}
        </div>
      </Card>
    </div>
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
          : "border-b-2 border-transparent text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
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

      {tab === "systems" ? <SystemsMockMonitoringPanel /> : null}

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
