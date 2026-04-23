"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cloud, Maximize2, ShieldAlert, Sparkles } from "lucide-react";
import { isApiMode } from "@/lib/api";
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

const BC_TZ = "America/Vancouver";
const NORTH_SAANICH = { lat: 48.6548, lon: -123.4207 };

function timeInBc(d: Date): string {
  return d.toLocaleTimeString(undefined, { timeZone: BC_TZ, hour: "2-digit", minute: "2-digit" });
}

function dateInBc(d: Date): string {
  return d.toLocaleDateString(undefined, {
    timeZone: BC_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function bcDayBoundsIso(now: Date): { fromIso: string; toIso: string } {
  // Compute local YYYY-MM-DD in BC, then anchor boundaries in BC by using the offset in ISO strings.
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: BC_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // ymd is "YYYY-MM-DD" in en-CA
  const fromIso = `${ymd}T00:00:00`;
  const toIso = `${ymd}T23:59:59.999`;
  return { fromIso, toIso };
}

type Weather = { tempC: number | null; code: number | null; windKph: number | null };

function weatherLabelFromCode(code: number | null): string {
  if (code === null) return "—";
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm (hail)";
  return `Code ${code}`;
}

type ScheduleEvent = {
  id: string;
  program_name: string;
  start_time: string;
  end_time: string;
  location: string;
  staff: string[];
  status?: string | null;
};

async function fetchNorthSaanichWeather(): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${NORTH_SAANICH.lat}` +
    `&longitude=${NORTH_SAANICH.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=${encodeURIComponent(BC_TZ)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  };
  return {
    tempC: typeof data.current?.temperature_2m === "number" ? data.current.temperature_2m : null,
    code: typeof data.current?.weather_code === "number" ? data.current.weather_code : null,
    windKph: typeof data.current?.wind_speed_10m === "number" ? data.current.wind_speed_10m : null,
  };
}

// Note: local-day helpers removed in favor of `bcDayBoundsIso`.

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
  const [weather, setWeather] = useState<Weather>({ tempC: null, code: null, windKph: null });
  const [facilitySchedule, setFacilitySchedule] = useState<ScheduleEvent[]>([]);

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

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch("/api/schedule", { cache: "no-store" });
        if (!res.ok) throw new Error("schedule_fetch_failed");
        const data = (await res.json()) as ScheduleEvent[];
        if (!cancel) setFacilitySchedule(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel) setFacilitySchedule([]);
      }
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => {
      cancel = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const w = await fetchNorthSaanichWeather();
        if (!cancel) setWeather(w);
      } catch {
        if (!cancel) setWeather({ tempC: null, code: null, windKph: null });
      }
    };
    void load();
    const t = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      cancel = true;
      window.clearInterval(t);
    };
  }, []);

  const kioskToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("token");
      return t && t.length > 10 ? t : null;
    } catch {
      return null;
    }
  }, []);

  const apiFetchWorker = useCallback(
    async <T,>(path: string): Promise<T> => {
      const sess = readSession();
      const token = sess?.access_token ?? kioskToken;
      if (!token) throw new Error("no_token");
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`http_${res.status}`);
      return (await res.json()) as T;
    },
    [kioskToken],
  );

  const loadToday = useCallback(async () => {
    // Public worker dashboard must render without auth. When not authenticated,
    // fall back to kiosk demo content (placeholders).
    const sess = readSession();
    const canLoadLive = isApiMode() && (Boolean(sess?.access_token) || Boolean(kioskToken));
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
      const { fromIso, toIso } = bcDayBoundsIso(new Date());
      const [w, z, sh] = await Promise.all([
        apiFetchWorker<PulseWorkerApi[]>("/api/v1/pulse/workers"),
        apiFetchWorker<PulseZoneApi[]>("/api/v1/pulse/schedule-facilities"),
        apiFetchWorker<PulseShiftApi[]>(
          `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
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
  }, [apiFetchWorker, kioskToken]);

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
    window.open(`${window.location.origin}/kiosk/worker`, "_blank", "noopener,noreferrer");
  }, []);

  const weatherLabel = useMemo(() => weatherLabelFromCode(weather.code), [weather.code]);
  const weatherTemp = useMemo(() => (weather.tempC == null ? "—" : `${Math.round(weather.tempC)}°C`), [weather.tempC]);

  return (
    <div className={`mx-auto w-full max-w-6xl space-y-6 px-4 py-6 ${kiosk ? "max-w-none px-6 py-6" : ""}`}>
      <KioskCriticalModal alert={criticalAlert} onAcknowledge={() => setCriticalAlert(null)} />

      <div className="rounded-2xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ds-muted">Worker dashboard</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ds-foreground">
              <span>{dateInBc(now)}</span>
              <span className="text-ds-muted">•</span>
              <span className="tabular-nums">{timeInBc(now)}</span>
              <span className="text-ds-muted">•</span>
              <span className="inline-flex items-center gap-1.5 text-ds-muted">
                <Cloud className="h-4 w-4" aria-hidden />
                {weatherTemp} · {weatherLabel}
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
              <p className="font-headline text-base font-extrabold text-ds-foreground">Facility schedule</p>
              <span className="text-xs font-semibold text-ds-muted tabular-nums">{timeInBc(now)}</span>
            </div>
            <div className="mt-4 space-y-4">
              {facilitySchedule.length === 0 ? (
                <p className="text-sm text-ds-muted">Loading schedule…</p>
              ) : (
                Object.entries(
                  facilitySchedule.reduce<Record<string, ScheduleEvent[]>>((acc, ev) => {
                    (acc[ev.location] ||= []).push(ev);
                    return acc;
                  }, {}),
                ).map(([loc, events]) => (
                  <div key={loc} className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ds-muted">{loc}</p>
                    <ul className="space-y-2 text-sm">
                      {events
                        .slice()
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                        .slice(0, kiosk ? 10 : 8)
                        .map((ev) => (
                          <li
                            key={ev.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-ds-border bg-ds-secondary/25 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ds-foreground">{ev.program_name}</p>
                              {ev.staff?.length ? (
                                <p className="mt-0.5 truncate text-xs text-ds-muted">{ev.staff.join(", ")}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-xs font-bold text-ds-muted tabular-nums">
                              {new Date(ev.start_time).toLocaleTimeString(undefined, { timeZone: BC_TZ, hour: "2-digit", minute: "2-digit" })}–
                              {new Date(ev.end_time).toLocaleTimeString(undefined, { timeZone: BC_TZ, hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
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

