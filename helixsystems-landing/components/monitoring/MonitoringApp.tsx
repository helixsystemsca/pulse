"use client";

import { Activity, Server, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { patchOnboarding } from "@/lib/onboardingService";
import {
  co2StatusLabel,
  co2Tanks,
  getCo2TankStatus,
  mockPeopleRows,
  poolControllers,
  type Co2TankStatus,
} from "@/lib/monitoringMockData";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function co2BarColor(status: Co2TankStatus): string {
  if (status === "change_now") return "bg-red-500";
  if (status === "change_soon") return "bg-amber-400";
  return "bg-emerald-500";
}

function co2BadgeClass(status: Co2TankStatus): string {
  if (status === "change_now") return "bg-red-50 text-red-900 ring-1 ring-red-200/80";
  if (status === "change_soon") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
}

function peopleStatusBadge(status: "active" | "idle" | "offline"): string {
  if (status === "active") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  if (status === "idle") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
}

function feederDot(active: boolean): string {
  return active ? "bg-emerald-500" : "bg-slate-300";
}

type MainTab = "systems" | "people";

export function MonitoringApp() {
  const [tab, setTab] = useState<MainTab>("systems");

  useEffect(() => {
    if (!isApiMode()) return;
    let cancelled = false;
    (async () => {
      try {
        await patchOnboarding({ step: "view_operations", completed: true });
        await refreshPulseUserFromServer();
        if (!cancelled) emitOnboardingMaybeUpdated();
      } catch {
        /* worker / 403 / offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabBtn = (id: MainTab, label: string, Icon: typeof Server) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        tab === id ? "bg-sky-50/95 text-[#1e4a8a] ring-1 ring-sky-200/80" : "text-pulse-navy hover:bg-white/80"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Real-time visibility into people and systems"
        icon={Activity}
      />

      <nav
        className="flex flex-wrap gap-1 rounded-md border border-slate-200/90 bg-white p-1 shadow-sm"
        aria-label="Monitoring sections"
      >
        {tabBtn("systems", "Systems", Server)}
        {tabBtn("people", "People", Users)}
      </nav>

      {tab === "systems" ? (
        <div className="space-y-10">
          <section className="space-y-4" aria-labelledby="co2-heading">
            <h2 id="co2-heading" className="font-headline text-lg font-bold text-pulse-navy">
              CO₂ tank levels
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {co2Tanks.map((tank) => {
                const status = getCo2TankStatus(tank.level);
                const barPct = Math.min(100, Math.max(0, (tank.level / 1000) * 100));
                return (
                  <Card key={tank.id} padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-pulse-navy">{tank.name}</p>
                        <p className="mt-0.5 text-sm text-pulse-muted">{tank.location}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${co2BadgeClass(status)}`}
                      >
                        {co2StatusLabel(status)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={LABEL}>Level (0–1000)</span>
                        <span className="font-headline text-lg font-bold tabular-nums text-pulse-navy">{tank.level}</span>
                      </div>
                      <div
                        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={tank.level}
                        aria-valuemin={0}
                        aria-valuemax={1000}
                        aria-label={`${tank.name} level`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${co2BarColor(status)}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="pool-heading">
            <h2 id="pool-heading" className="font-headline text-lg font-bold text-pulse-navy">
              Pool controllers
            </h2>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {poolControllers.map((c) => (
                <Card key={c.id} padding="md" className="flex flex-col gap-4">
                  <p className="font-semibold text-pulse-navy">{c.name}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className={LABEL}>Chlorine</p>
                      <p className="mt-1 font-headline text-base font-bold tabular-nums text-pulse-navy">{c.chlorine} ppm</p>
                    </div>
                    <div>
                      <p className={LABEL}>pH</p>
                      <p className="mt-1 font-headline text-base font-bold tabular-nums text-pulse-navy">{c.ph}</p>
                    </div>
                    <div>
                      <p className={LABEL}>Flow</p>
                      <p className="mt-1 font-headline text-base font-bold tabular-nums text-pulse-navy">{c.flow}</p>
                    </div>
                    <div>
                      <p className={LABEL}>Temp</p>
                      <p className="mt-1 font-headline text-base font-bold tabular-nums text-pulse-navy">{c.temp}°C</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${feederDot(c.co2FeederActive)}`} aria-hidden />
                      <span className="text-sm font-medium text-pulse-navy">CO₂ feeder</span>
                      <span className="text-xs text-pulse-muted">{c.co2FeederActive ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${feederDot(c.chlorineFeederActive)}`}
                        aria-hidden
                      />
                      <span className="text-sm font-medium text-pulse-navy">Chlorine feeder</span>
                      <span className="text-xs text-pulse-muted">{c.chlorineFeederActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="sr-only">
            People monitoring
          </h2>
          <Card padding="md">
            <p className="mb-4 text-sm text-pulse-muted">
              Mock roster — connect HR / attendance and presence feeds when ready.
            </p>
            <ul className="divide-y divide-slate-100">
              {mockPeopleRows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-pulse-navy">{row.name}</p>
                    <p className="text-sm text-pulse-muted">{row.role}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${peopleStatusBadge(row.status)}`}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
