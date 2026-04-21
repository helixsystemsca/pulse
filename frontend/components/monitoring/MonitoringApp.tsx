"use client";

import { Activity, Server, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { fetchSetupProgress, patchOnboarding } from "@/lib/onboardingService";
import { readSession } from "@/lib/pulse-session";
import { fetchPeopleMonitoring, type PeopleMonitorRow } from "@/lib/monitoringPeopleService";
import {
  co2StatusLabel,
  co2Tanks,
  getCo2TankStatus,
  poolControllers,
  type Co2TankStatus,
} from "@/lib/monitoringMockData";
import { WowXpBar } from "@/components/gamification/WowXpBar";

function EmptyMonitoringPanel({ message }: { message: string }) {
  return (
    <Card padding="md" className="border-dashed border-ds-border bg-ds-secondary/30">
      <p className="text-sm text-ds-muted">{message}</p>
    </Card>
  );
}

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

function co2BarColor(status: Co2TankStatus): string {
  if (status === "change_now") return "bg-ds-danger";
  if (status === "change_soon") return "bg-ds-warning";
  return "bg-ds-success";
}

function co2BadgeClass(status: Co2TankStatus): string {
  if (status === "change_now") return "app-badge-red";
  if (status === "change_soon") return "app-badge-amber";
  return "app-badge-emerald";
}

function peopleStatusBadge(status: "active" | "idle" | "offline"): string {
  if (status === "active") return "app-badge-emerald";
  if (status === "idle") return "app-badge-amber";
  return "app-badge-slate";
}

function feederDot(active: boolean): string {
  return active ? "bg-ds-success" : "bg-ds-muted";
}

type MainTab = "systems" | "people";

export function MonitoringApp() {
  const [tab, setTab] = useState<MainTab>("systems");
  const [demoSensors, setDemoSensors] = useState(false);
  const [peopleRows, setPeopleRows] = useState<PeopleMonitorRow[] | null>(null);
  const [peopleErr, setPeopleErr] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isApiMode()) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchPeopleMonitoring();
        if (!cancelled) {
          setPeopleRows(rows);
          setPeopleErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPeopleRows([]);
          setPeopleErr(e instanceof Error ? e.message : "Failed to load people");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isApiMode()) return;
    const s = readSession();
    if (!s?.access_token) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchSetupProgress();
        if (!cancelled) setDemoSensors(p.onboarding_demo_sensors === true);
      } catch {
        if (!cancelled) setDemoSensors(false);
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
      <PageHeader
        title="Monitoring"
        description="Real-time visibility into people and systems"
        icon={Activity}
      />

      {demoSensors ? (
        <div className="ds-notification ds-notification-warning flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ds-foreground">
          <span>Demo monitoring data is active for your organization.</span>
        </div>
      ) : null}

      <nav
        className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
        aria-label="Monitoring sections"
      >
        {tabBtn("systems", "Systems", Server)}
        {tabBtn("people", "People", Users)}
      </nav>

      {tab === "systems" ? (
        demoSensors ? (
          <div className="space-y-10">
            <section className="space-y-4" aria-labelledby="co2-heading">
              <h2 id="co2-heading" className="font-headline text-lg font-bold text-ds-foreground">
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
                          <p className="font-semibold text-ds-foreground">{tank.name}</p>
                          <p className="mt-0.5 text-sm text-ds-muted">{tank.location}</p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${co2BadgeClass(status)}`}>
                          {co2StatusLabel(status)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={LABEL}>Level (0–1000)</span>
                          <span className="font-headline text-lg font-bold tabular-nums text-ds-foreground">{tank.level}</span>
                        </div>
                        <div
                          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ds-secondary"
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
              <h2 id="pool-heading" className="font-headline text-lg font-bold text-ds-foreground">
                Pool controllers
              </h2>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {poolControllers.map((c) => (
                  <Card key={c.id} padding="md" className="flex flex-col gap-4">
                    <p className="font-semibold text-ds-foreground">{c.name}</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className={LABEL}>Chlorine</p>
                        <p className="mt-1 font-headline text-base font-bold tabular-nums text-ds-foreground">{c.chlorine} ppm</p>
                      </div>
                      <div>
                        <p className={LABEL}>pH</p>
                        <p className="mt-1 font-headline text-base font-bold tabular-nums text-ds-foreground">{c.ph}</p>
                      </div>
                      <div>
                        <p className={LABEL}>Flow</p>
                        <p className="mt-1 font-headline text-base font-bold tabular-nums text-ds-foreground">{c.flow}</p>
                      </div>
                      <div>
                        <p className={LABEL}>Temp</p>
                        <p className="mt-1 font-headline text-base font-bold tabular-nums text-ds-foreground">{c.temp}°C</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6 border-t border-ds-border pt-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${feederDot(c.co2FeederActive)}`} aria-hidden />
                        <span className="text-sm font-medium text-ds-foreground">CO₂ feeder</span>
                        <span className="text-xs text-ds-muted">{c.co2FeederActive ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${feederDot(c.chlorineFeederActive)}`}
                          aria-hidden
                        />
                        <span className="text-sm font-medium text-ds-foreground">Chlorine feeder</span>
                        <span className="text-xs text-ds-muted">{c.chlorineFeederActive ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <EmptyMonitoringPanel message="No system telemetry here yet. When your organization turns on sample monitoring during onboarding, preview tiles appear in this tab. Otherwise this stays empty until your own sensors and controllers are connected." />
        )
      ) : (
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="sr-only">
            People monitoring
          </h2>
          <Card padding="md">
            <p className="mb-4 text-sm text-ds-muted">Workforce roster with XP progress and recently assigned tasks.</p>

            {peopleErr ? (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
                {peopleErr}
              </div>
            ) : null}

            {!peopleRows ? (
              <p className="text-sm text-ds-muted">Loading…</p>
            ) : peopleRows.length === 0 ? (
              <p className="text-sm text-ds-muted">No participating employees yet. Ask users to enable workforce participation in Profile.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {peopleRows.map((row) => {
                  const openCount = row.recent_tasks?.length ?? 0;
                  return (
                    <div
                      key={row.user_id}
                      className="rounded-xl border border-ds-border bg-ds-secondary/20 p-3 shadow-[var(--ds-shadow-card)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ds-foreground">{row.full_name}</p>
                          <p className="mt-0.5 truncate text-xs text-ds-muted">{row.role}</p>
                        </div>
                        <span className="shrink-0 rounded-lg border border-ds-border bg-ds-primary px-2 py-1 text-[11px] font-semibold text-ds-muted">
                          {openCount} task{openCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-3">
                        <WowXpBar totalXp={row.xp.total_xp} level={row.xp.level} size="sm" />
                      </div>

                      {openCount ? (
                        <div className="mt-3 space-y-1">
                          {row.recent_tasks.slice(0, 2).map((t) => (
                            <p key={t.id} className="truncate text-xs font-medium text-ds-foreground/90">
                              • {t.title}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-ds-muted">No open tasks.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
