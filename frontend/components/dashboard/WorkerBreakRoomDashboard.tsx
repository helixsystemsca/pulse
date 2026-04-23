"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cloud, Maximize2, ShieldAlert, Sparkles } from "lucide-react";
import { apiFetch, isApiMode } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { pulseShiftsToSchedule, pulseWorkersToSchedule, type PulseZoneApi } from "@/lib/schedule/pulse-bridge";
import type { Shift, Worker } from "@/lib/schedule/types";
import { shiftBandForWindow } from "@/lib/schedule/shift-codes";

type Props = {
  kiosk?: boolean;
};

type Notification = { id: string; message: string; tone?: "info" | "warning" };
type CriticalAlert = { id: string; title: string; detail?: string; source?: string; happenedAt?: string };

function nowString(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dateString(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function startOfLocalDayIso(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDayIso(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function bandLabel(b: "D" | "A" | "N"): string {
  if (b === "D") return "Day";
  if (b === "A") return "Afternoon";
  return "Night";
}

function chipTone(b: "D" | "A" | "N"): string {
  if (b === "D") return "bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-surface-primary))] border-ds-border text-ds-foreground";
  if (b === "A") return "bg-[color-mix(in_srgb,var(--ds-warning)_14%,var(--ds-surface-primary))] border-ds-border text-ds-foreground";
  return "bg-[color-mix(in_srgb,var(--ds-danger)_10%,var(--ds-surface-primary))] border-ds-border text-ds-foreground";
}

function KioskCriticalModal({ alert, onAcknowledge }: { alert: CriticalAlert | null; onAcknowledge: () => void }) {
  if (!alert) return null;
  return (
    <div className="ds-modal-backdrop fixed inset-0 z-[220] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-200/70 bg-white shadow-2xl dark:border-rose-500/35 dark:bg-ds-primary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="critical-alert-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rose-200/70 bg-rose-50/70 px-6 py-5 dark:border-rose-500/35 dark:bg-rose-950/35">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-200">
              Critical alert
            </p>
            <h2 id="critical-alert-title" className="mt-2 flex items-center gap-2 text-lg font-extrabold text-rose-900 dark:text-rose-100">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              <span className="truncate">{alert.title}</span>
            </h2>
            {alert.detail ? <p className="mt-1.5 text-sm text-rose-900/90 dark:text-rose-100/90">{alert.detail}</p> : null}
            <p className="mt-2 text-xs font-semibold text-rose-700/90 dark:text-rose-200/90">
              {alert.source ? `${alert.source} · ` : ""}{alert.happenedAt ? alert.happenedAt : "Just now"}
            </p>
          </div>
          <AlertTriangle className="h-6 w-6 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-ds-foreground">Acknowledge and dispatch a supervisor.</p>
          <p className="mt-1 text-sm text-ds-muted">
            This is a placeholder modal until live alerts are wired in (CO₂, pool chemistry, etc.).
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:ring-offset-ds-primary"
              onClick={onAcknowledge}
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkerBreakRoomDashboard({ kiosk = false }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [criticalAlert, setCriticalAlert] = useState<CriticalAlert | null>(null);

  const notifications: Notification[] = useMemo(
    () => [
      { id: "n1", message: "Welcome. PPE required on deck. Report hazards immediately.", tone: "info" },
      { id: "n2", message: "Reminder: chemical room access is supervisor-only.", tone: "warning" },
      { id: "n3", message: "Ice clean schedule is placeholder until Xplor API is connected.", tone: "info" },
    ],
    [],
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const loadToday = useCallback(async () => {
    // Public worker dashboard must render without auth. When not authenticated,
    // fall back to kiosk demo content (placeholders).
    const sess = readSession();
    const canLoadLive = isApiMode() && Boolean(sess?.access_token);
    if (!canLoadLive) {
      setWorkers([
        { id: "wk-1", name: "Jordan Lee", role: "lead", active: true },
        { id: "wk-2", name: "Sam Rivera", role: "supervisor", active: true },
        { id: "wk-3", name: "Alex Chen", role: "worker", active: true },
        { id: "wk-4", name: "Riley Brooks", role: "worker", active: true },
      ]);
      setShifts([
        { id: "sh-1", workerId: "wk-1", date: "today", startTime: "06:00", endTime: "14:00", shiftType: "day", eventType: "work", role: "lead", zoneId: "z1" },
        { id: "sh-2", workerId: "wk-3", date: "today", startTime: "06:00", endTime: "14:00", shiftType: "day", eventType: "work", role: "worker", zoneId: "z1" },
        { id: "sh-3", workerId: "wk-4", date: "today", startTime: "14:00", endTime: "22:00", shiftType: "afternoon", eventType: "work", role: "worker", zoneId: "z2" },
        { id: "sh-4", workerId: "wk-2", date: "today", startTime: "22:00", endTime: "06:00", shiftType: "night", eventType: "work", role: "supervisor", zoneId: "z3" },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const from = startOfLocalDayIso(new Date());
      const to = endOfLocalDayIso(new Date());
      const [w, z, sh] = await Promise.all([
        apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
        apiFetch<PulseZoneApi[]>("/api/v1/pulse/zones"),
        apiFetch<PulseShiftApi[]>(
          `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      ]);
      const zonesMapped = z;
      const fallbackZ = zonesMapped[0]?.id ?? "";
      setWorkers(pulseWorkersToSchedule(w));
      setShifts(pulseShiftsToSchedule(sh, fallbackZ));
    } catch {
      setWorkers([]);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  // Placeholder critical alert trigger: show when `?critical=1` is present in kiosk/new-tab URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("critical") !== "1") return;
    setCriticalAlert({
      id: "demo-critical",
      title: "CO₂ sensor reading high",
      detail: "Auto-triggered placeholder. Verify ventilation and notify supervisor.",
      source: "Mechanical room",
      happenedAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    });
  }, []);

  const byId = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const todaysWork = useMemo(() => shifts.filter((s) => s.eventType === "work" && s.workerId), [shifts]);

  const grouped = useMemo(() => {
    const out: Record<"D" | "A" | "N", Shift[]> = { D: [], A: [], N: [] };
    for (const s of todaysWork) {
      out[shiftBandForWindow(s.startTime, s.endTime)].push(s);
    }
    for (const k of ["D", "A", "N"] as const) {
      out[k].sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.workerId ?? "").localeCompare(b.workerId ?? ""));
    }
    return out;
  }, [todaysWork]);

  const openKiosk = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(`${window.location.origin}/worker`, "_blank", "noopener,noreferrer");
  }, []);

  const weather = useMemo(() => ({ temp: "—", condition: "Weather TBD" }), []);

  return (
    <div className={`mx-auto w-full max-w-6xl space-y-6 px-4 py-6 ${kiosk ? "max-w-none px-6 py-6" : ""}`}>
      <KioskCriticalModal alert={criticalAlert} onAcknowledge={() => setCriticalAlert(null)} />

      <div className="rounded-2xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ds-muted">Worker dashboard</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ds-foreground">
              <span>{dateString(now)}</span>
              <span className="text-ds-muted">•</span>
              <span className="tabular-nums">{nowString(now)}</span>
              <span className="text-ds-muted">•</span>
              <span className="inline-flex items-center gap-1.5 text-ds-muted">
                <Cloud className="h-4 w-4" aria-hidden />
                {weather.temp} · {weather.condition}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!kiosk ? (
              <button
                type="button"
                className="ds-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
                onClick={openKiosk}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                Fullscreen
              </button>
            ) : null}
            <button
              type="button"
              className="ds-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              onClick={() =>
                setCriticalAlert({
                  id: crypto.randomUUID(),
                  title: "Test: Pool readings out of range",
                  detail: "Placeholder alert. Replace with real telemetry once Xplor / sensors are connected.",
                  source: "Aquatics",
                  happenedAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
                })
              }
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Test alert
            </button>
          </div>
        </div>

        <div className="border-t border-ds-border bg-ds-secondary/40">
          <div className="relative overflow-hidden px-5 py-2">
            <div className="kiosk-marquee whitespace-nowrap text-sm font-semibold text-ds-foreground">
              {notifications.map((n) => (
                <span key={n.id} className={`mr-10 ${n.tone === "warning" ? "text-amber-700 dark:text-amber-200" : ""}`}>
                  <Sparkles className="mr-2 inline-block h-4 w-4 opacity-80" aria-hidden />
                  {n.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-headline text-base font-extrabold text-ds-foreground">Who’s on shift</p>
                <p className="mt-1 text-xs text-ds-muted">Auto from Schedule (today).</p>
              </div>
              <p className="text-xs font-semibold text-ds-muted">{loading ? "Loading…" : `${todaysWork.length} scheduled`}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["D", "A", "N"] as const).map((band) => (
                <div key={band} className="rounded-xl border border-ds-border bg-ds-secondary/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ds-muted">{bandLabel(band)}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${chipTone(band)}`}>
                      {grouped[band].length}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {grouped[band].length === 0 ? (
                      <li className="text-ds-muted">—</li>
                    ) : (
                      grouped[band].slice(0, kiosk ? 14 : 10).map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-2 dark:bg-ds-primary">
                          <span className="min-w-0 truncate font-semibold text-ds-foreground">
                            {s.workerId ? byId.get(s.workerId)?.name ?? "Worker" : "Open"}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-ds-muted tabular-nums">
                            {s.startTime}–{s.endTime}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-headline text-base font-extrabold text-ds-foreground">Assignments</p>
                <p className="mt-1 text-xs text-ds-muted">Placeholder until Work Requests + Xplor integration.</p>
              </div>
              <p className="text-xs font-semibold text-ds-muted">Today</p>
            </div>

            <div className="mt-4 space-y-2">
              {(todaysWork.length ? todaysWork.slice(0, kiosk ? 14 : 10) : []).map((s) => (
                <div
                  key={`asg-${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ds-border bg-ds-secondary/25 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-ds-foreground">
                      {s.workerId ? byId.get(s.workerId)?.name ?? "Worker" : "Open slot"}
                    </p>
                    <p className="mt-0.5 text-xs text-ds-muted">
                      {bandLabel(shiftBandForWindow(s.startTime, s.endTime))} · {s.zoneId ? `Zone ${s.zoneId.slice(0, 6)}` : "—"}
                    </p>
                  </div>
                  <span className="rounded-full border border-ds-border bg-white px-3 py-1 text-xs font-bold text-ds-foreground dark:bg-ds-elevated">
                    Placeholder: Ice clean / Setup / Takedown
                  </span>
                </div>
              ))}
              {todaysWork.length === 0 ? <p className="text-sm text-ds-muted">No shifts found for today.</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-ds-border bg-[linear-gradient(120deg,#36F1CD_0%,#4C6085_80%)] p-5 text-white shadow-[var(--ds-shadow-card-hover)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/80">Ice & facility cadence</p>
            <p className="mt-2 text-base font-extrabold">Set-ups • Ice cleans • Takedowns</p>
            <p className="mt-1 text-sm text-white/90">
              Placeholder schedule until Xplor Recreation API is connected.
            </p>
          </div>

          <div className="rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary">
            <div className="flex items-center justify-between gap-3">
              <p className="font-headline text-base font-extrabold text-ds-foreground">Today’s cadence</p>
              <span className="text-xs font-semibold text-ds-muted tabular-nums">{nowString(now)}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                { t: "06:00", label: "Morning setup" },
                { t: "09:30", label: "Ice clean" },
                { t: "12:00", label: "Midday reset" },
                { t: "15:30", label: "Ice clean" },
                { t: "19:00", label: "Evening takedown" },
              ].map((x) => (
                <li key={x.t} className="flex items-center justify-between gap-3 rounded-xl border border-ds-border bg-ds-secondary/25 px-4 py-3">
                  <span className="font-semibold text-ds-foreground">{x.label}</span>
                  <span className="text-xs font-bold text-ds-muted tabular-nums">{x.t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary">
            <p className="font-headline text-base font-extrabold text-ds-foreground">Notes</p>
            <p className="mt-2 text-sm text-ds-muted">
              This panel is intentionally “kiosk safe” (large text, high contrast). Next we can wire real-time data and critical
              alerts into the modal above.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kiosk-marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marquee 38s linear infinite;
        }
        @keyframes marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-100%, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .kiosk-marquee {
            animation: none;
            padding-left: 0;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}

/** Alias name matching route intent (`/worker`). */
export const WorkerDashboard = WorkerBreakRoomDashboard;

