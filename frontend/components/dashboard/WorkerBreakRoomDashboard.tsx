"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Cloud, Monitor, Palette, Pencil, ShieldAlert, Sparkles } from "lucide-react";

import { DashboardAccentCard, DashboardColumnPanel } from "@/components/dashboard/DashboardChrome";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";
import { isApiMode } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import { canAccessCompanyConfiguration, sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";
import { GridLayout, useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { pulseShiftsToSchedule, pulseWorkersToSchedule, type PulseZoneApi } from "@/lib/schedule/pulse-bridge";
import type { Shift, Worker } from "@/lib/schedule/types";
import { shiftBandForWindow } from "@/lib/schedule/shift-codes";
import { UI } from "@/styles/ui";
import { DASHBOARD_WIDGET_STYLE_STORAGE, type DashboardWidgetStyleOverride } from "@/lib/dashboardPageWidgetCatalog";

type Props = {
  kiosk?: boolean;
};

type Notification = { id: string; message: string; tone?: "info" | "warning" };
type CriticalAlert = { id: string; title: string; detail?: string; source?: string; happenedAt?: string };

const BC_TZ = "America/Vancouver";
const NORTH_SAANICH = { lat: 48.6548, lon: -123.4207 };

const OPS_DASH_HEADER_TOOL =
  "h-10 w-10 min-h-0 rounded-lg !border-2 !border-ds-border bg-transparent !px-0 !py-0 text-ds-foreground shadow-none ring-0 transition-colors hover:!border-[var(--ds-accent)] hover:!bg-[color-mix(in_srgb,var(--ds-accent)_14%,var(--ds-bg))] hover:!text-[var(--ds-accent)] focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-[var(--ds-accent)] dark:hover:!bg-[color-mix(in_srgb,var(--ds-accent)_20%,transparent)]";
const OPS_DASH_HEADER_TOOL_ACTIVE =
  "h-10 w-10 min-h-0 rounded-lg !border-0 !bg-[var(--ds-accent)] !px-0 !py-0 !text-white shadow-none ring-0 transition-colors hover:!border-0 hover:!bg-[color-mix(in_srgb,var(--ds-accent)_88%,#0f172a)] hover:!text-white focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-white/80";

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
      <div className="relative z-10 w-full max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="critical-alert-title">
      <Card className="overflow-hidden border border-red-200 p-0 shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-red-200 bg-red-50 px-6 py-5">
          <div className="min-w-0">
            <p className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${UI.subheader}`}>Critical alert</p>
            <h2 id="critical-alert-title" className="mt-2 flex items-center gap-2 text-lg font-extrabold text-red-900">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              <span className="truncate">{alert.title}</span>
            </h2>
            {alert.detail ? <p className="mt-1.5 text-sm text-red-900">{alert.detail}</p> : null}
            <p className="mt-2 text-xs font-semibold text-red-800">
              {alert.source ? `${alert.source} · ` : ""}{alert.happenedAt ? alert.happenedAt : "Just now"}
            </p>
          </div>
          <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" aria-hidden />
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-900">Acknowledge and dispatch a supervisor.</p>
          <p className={`mt-1 text-sm ${UI.subheader}`}>
            This is a placeholder modal until live alerts are wired in (CO₂, pool chemistry, etc.).
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" onClick={onAcknowledge}>
              Acknowledge
            </Button>
          </div>
        </div>
      </Card>
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
  const facilityScheduleSupported = useRef(true);

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
        if (!facilityScheduleSupported.current) return;
        const res = await fetch("/api/schedule", { cache: "no-store" });
        if (res.status === 404) {
          facilityScheduleSupported.current = false;
          if (!cancel) setFacilitySchedule([]);
          return;
        }
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

  const DASHBOARD_BASE_COLS = 12;
  const DASHBOARD_GRID_UNIT_PX = 140;
  const DASHBOARD_GRID_GAP_PX = 12;
  const DASHBOARD_MAX_COLS_STANDARD = 12;
  const DASHBOARD_MAX_COLS_KIOSK = 16;

  const DASH_LAYOUT_STORAGE = kiosk ? null : "pulse_dashboard_layout_v3_worker_standard";
  const sess = readSession();
  const primaryRole = sessionPrimaryRole(sess);
  const canEdit = !kiosk && canAccessCompanyConfiguration(sess);

  function gridColsForWidth(widthPx: number, kioskMode: boolean): number {
    const max = kioskMode ? DASHBOARD_MAX_COLS_KIOSK : DASHBOARD_MAX_COLS_STANDARD;
    const cols = Math.floor((Math.max(0, widthPx) + DASHBOARD_GRID_GAP_PX) / (DASHBOARD_GRID_UNIT_PX + DASHBOARD_GRID_GAP_PX));
    return Math.max(1, Math.min(max, cols));
  }

  function layoutForCols(layout: Layout, cols: number): Layout {
    if (cols >= DASHBOARD_BASE_COLS) return layout;
    if (cols <= 1) return layout.map((it) => ({ ...it, x: 0, w: 1, minW: 1 }));
    const scale = cols / DASHBOARD_BASE_COLS;
    return layout.map((it) => {
      const w = Math.max(1, Math.min(cols, Math.round((it.w ?? 1) * scale)));
      const minW = Math.max(1, Math.min(w, Math.round(((it.minW ?? 1) as number) * scale)));
      const x = Math.max(0, Math.min(cols - w, Math.round((it.x ?? 0) * scale)));
      return { ...it, x, w, minW };
    });
  }

  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (!canEdit) setEditMode(false);
  }, [canEdit]);
  const [widgetStyles, setWidgetStyles] = useState<Record<string, DashboardWidgetStyleOverride>>({});
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [styleEditorTarget, setStyleEditorTarget] = useState<{ id: string; title: string } | null>(null);
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const defaultLayout = useMemo(
    (): Layout => [
      { i: "who", x: 0, y: 0, w: 8, h: 5, minW: 6, minH: 4 },
      { i: "schedule", x: 8, y: 0, w: 4, h: 9, minW: 3, minH: 4 },
      { i: "assignments", x: 0, y: 5, w: 8, h: 4, minW: 6, minH: 3 },
      { i: "cadence", x: 0, y: 9, w: 6, h: 3, minW: 3, minH: 2 },
      { i: "notes", x: 6, y: 9, w: 6, h: 3, minW: 3, minH: 2 },
    ],
    [],
  );
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [isInteracting, setIsInteracting] = useState(false);
  const persistLayout = useCallback(
    (next: Layout) => {
      if (!DASH_LAYOUT_STORAGE || !layoutHydrated) return;
      try {
        window.localStorage.setItem(DASH_LAYOUT_STORAGE, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [DASH_LAYOUT_STORAGE, layoutHydrated],
  );
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  useEffect(() => {
    if (!DASH_LAYOUT_STORAGE) return;
    try {
      let raw = window.localStorage.getItem(DASH_LAYOUT_STORAGE);
      if (!raw) {
        const legacy = window.localStorage.getItem("worker_dashboard_layout_v1");
        if (legacy) {
          raw = legacy;
          try {
            window.localStorage.setItem(DASH_LAYOUT_STORAGE, legacy);
          } catch {
            /* ignore */
          }
        }
      }
      if (raw) setLayout(JSON.parse(raw) as Layout);
    } catch {
      /* ignore */
    } finally {
      setLayoutHydrated(true);
    }
  }, [DASH_LAYOUT_STORAGE]);

  // Persist layout only on drag/resize stop (and explicit add/remove actions).

  const widgetStyleStorageKey = useMemo(() => {
    const mode = kiosk ? "kiosk" : "standard";
    return `${DASHBOARD_WIDGET_STYLE_STORAGE}_worker_${mode}`;
  }, [kiosk]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = window.localStorage.getItem(widgetStyleStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, DashboardWidgetStyleOverride>;
      if (parsed && typeof parsed === "object") setWidgetStyles(parsed);
    } catch {
      /* ignore */
    }
  }, [mounted, widgetStyleStorageKey]);

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      window.localStorage.setItem(widgetStyleStorageKey, JSON.stringify(widgetStyles));
    } catch {
      /* ignore */
    }
  }, [layoutHydrated, widgetStyles, widgetStyleStorageKey]);

  return (
    <div className={cn(DASH.page, "space-y-6")}>
      <KioskCriticalModal alert={criticalAlert} onAcknowledge={() => setCriticalAlert(null)} />

      <DashboardAccentCard tier="hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={DASH.sectionLabel}>Operations dashboard</p>
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
              <Button
                type="button"
                variant="secondary"
                className={OPS_DASH_HEADER_TOOL}
                onClick={openKiosk}
                title="Fullscreen"
                aria-label="Fullscreen"
              >
                <Monitor className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                className={cn(OPS_DASH_HEADER_TOOL, editMode && OPS_DASH_HEADER_TOOL_ACTIVE)}
                onClick={() => setEditMode((v) => !v)}
                aria-pressed={editMode}
                title={editMode ? "Done editing layout" : "Edit dashboard layout"}
                aria-label={editMode ? "Done editing layout" : "Edit dashboard layout"}
              >
                {editMode ? (
                  <Check className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Pencil className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="inline-flex items-center gap-2"
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
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-ds-border bg-ds-secondary/50">
          <div className="relative overflow-hidden py-2">
            <div className="kiosk-marquee whitespace-nowrap text-sm font-semibold text-ds-foreground">
              {notifications.map((n) => (
                <span key={n.id} className={cn("mr-10", n.tone === "warning" && "text-amber-800 dark:text-amber-200")}>
                  <Sparkles className="mr-2 inline-block h-4 w-4 opacity-80" aria-hidden />
                  {n.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DashboardAccentCard>

      <div className={editMode ? "pulse-dashboard-edit" : ""}>
        <div ref={containerRef as any}>
          {mounted ? (
            <GridLayout
              layout={layoutForCols(layout, gridColsForWidth(width, kiosk))}
              width={width}
              gridConfig={{
                cols: gridColsForWidth(width, kiosk),
                rowHeight: DASHBOARD_GRID_UNIT_PX,
                margin: [DASHBOARD_GRID_GAP_PX, DASHBOARD_GRID_GAP_PX],
                containerPadding: [0, 0],
              }}
              dragConfig={{
                enabled: canEdit && editMode,
                bounded: false,
                cancel: "button, a, input, textarea, select, option, [role='button'], .dashboard-no-drag",
              }}
              resizeConfig={{ enabled: canEdit && editMode, handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"] }}
              compactor={
                isInteracting
                  ? ({
                      type: null,
                      allowOverlap: true,
                      compact: (l: Layout) => l,
                    } as any)
                  : verticalCompactor
              }
              onDragStart={() => {
                if (!canEdit || !editMode) return;
                setIsInteracting(true);
              }}
              onResizeStart={() => {
                if (!canEdit || !editMode) return;
                setIsInteracting(true);
              }}
              onDrag={(next) => {
                if (!canEdit || !editMode) return;
                setLayout(next as Layout);
              }}
              onResize={(next) => {
                if (!canEdit || !editMode) return;
                setLayout(next as Layout);
              }}
              onDragStop={(next) => {
                if (!canEdit || !editMode) return;
                setIsInteracting(false);
                const cols = gridColsForWidth(width, kiosk);
                const compacted = verticalCompactor.compact(next as Layout, cols) as Layout;
                setLayout(compacted);
                persistLayout(compacted);
              }}
              onResizeStop={(next) => {
                if (!canEdit || !editMode) return;
                setIsInteracting(false);
                const cols = gridColsForWidth(width, kiosk);
                const compacted = verticalCompactor.compact(next as Layout, cols) as Layout;
                setLayout(compacted);
                persistLayout(compacted);
              }}
            >
              <div key="who" className={editMode ? "cursor-grab active:cursor-grabbing" : ""}>
                <DashboardAccentCard mutedAccent innerClassName="space-y-4 h-full" styleOverride={widgetStyles.who}>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={UI.header}>Who’s on shift</p>
                      <p className={`mt-1 ${UI.subheader}`}>Auto from Schedule (today).</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-semibold ${UI.subheader}`}>{loading ? "Loading…" : `${todaysWork.length} scheduled`}</p>
                      {canEdit && editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 min-w-0 px-0"
                          onClick={() => {
                            setStyleEditorTarget({ id: "who", title: "Who’s on shift" });
                            setStyleEditorOpen(true);
                          }}
                          aria-label="Widget style"
                          title="Widget style"
                        >
                          <Palette className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {canEdit && editMode ? (
                        <span className="dashboard-drag-handle select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["D", "A", "N"] as const).map((band) => (
                      <div
                        key={band}
                        className={cn(DASH.cardBase, "overflow-hidden")}
                      >
                        <div className="h-0.5 w-full bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--ds-accent)_55%,transparent),transparent)] opacity-80" aria-hidden />
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-extrabold uppercase tracking-[0.16em] ${UI.subheader}`}>{bandLabel(band)}</p>
                            <span className={`border px-2 py-0.5 text-[11px] font-extrabold ${chipTone(band)}`}>
                              {grouped[band].length}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-2 text-sm">
                            {grouped[band].length === 0 ? (
                              <li className={UI.subheader}>—</li>
                            ) : (
                              grouped[band].slice(0, kiosk ? 14 : 10).map((s) => (
                                <li
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 border border-ds-border bg-ds-secondary/40 px-2.5 py-2"
                                >
                                  <span className="min-w-0 truncate font-semibold text-ds-foreground">
                                    {s.workerId ? byId.get(s.workerId)?.name ?? "Worker" : "Open"}
                                  </span>
                                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${UI.subheader}`}>
                                    {s.startTime}–{s.endTime}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardAccentCard>
              </div>

              <div key="assignments" className={editMode ? "cursor-grab active:cursor-grabbing" : ""}>
                <DashboardAccentCard mutedAccent innerClassName="space-y-4 h-full" styleOverride={widgetStyles.assignments}>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={UI.header}>Assignments</p>
                      <p className={`mt-1 ${UI.subheader}`}>Placeholder until Work Requests + Xplor integration.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-semibold ${UI.subheader}`}>Today</p>
                      {canEdit && editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 min-w-0 px-0"
                          onClick={() => {
                            setStyleEditorTarget({ id: "assignments", title: "Assignments" });
                            setStyleEditorOpen(true);
                          }}
                          aria-label="Widget style"
                          title="Widget style"
                        >
                          <Palette className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {canEdit && editMode ? (
                        <span className="dashboard-drag-handle select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(todaysWork.length ? todaysWork.slice(0, kiosk ? 14 : 10) : []).map((s) => (
                      <div
                        key={`asg-${s.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 border border-ds-border bg-ds-secondary/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-ds-foreground">
                            {s.workerId ? byId.get(s.workerId)?.name ?? "Worker" : "Open slot"}
                          </p>
                          <p className={`mt-0.5 text-xs ${UI.subheader}`}>
                            {bandLabel(shiftBandForWindow(s.startTime, s.endTime))} · {s.zoneId ? `Zone ${s.zoneId.slice(0, 6)}` : "—"}
                          </p>
                        </div>
                        <span className="border border-ds-border bg-ds-secondary px-3 py-1 text-xs font-bold text-ds-foreground">
                          Placeholder: Ice clean / Setup / Takedown
                        </span>
                      </div>
                    ))}
                    {todaysWork.length === 0 ? <p className={`text-sm ${UI.subheader}`}>No shifts found for today.</p> : null}
                  </div>
                </DashboardAccentCard>
              </div>

              <div key="schedule" className={editMode ? "cursor-grab active:cursor-grabbing" : ""}>
                <DashboardAccentCard mutedAccent innerClassName="space-y-4 h-full" styleOverride={widgetStyles.schedule}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={UI.header}>Facility schedule</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold tabular-nums ${UI.subheader}`}>{timeInBc(now)}</span>
                      {canEdit && editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 min-w-0 px-0"
                          onClick={() => {
                            setStyleEditorTarget({ id: "schedule", title: "Facility schedule" });
                            setStyleEditorOpen(true);
                          }}
                          aria-label="Widget style"
                          title="Widget style"
                        >
                          <Palette className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {canEdit && editMode ? (
                        <span className="dashboard-drag-handle select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {facilitySchedule.length === 0 ? (
                      <p className={`text-sm ${UI.subheader}`}>Loading schedule…</p>
                    ) : (
                      Object.entries(
                        facilitySchedule.reduce<Record<string, ScheduleEvent[]>>((acc, ev) => {
                          (acc[ev.location] ||= []).push(ev);
                          return acc;
                        }, {}),
                      ).map(([loc, events]) => (
                        <div key={loc} className="space-y-2">
                          <p className={`text-xs font-extrabold uppercase tracking-[0.16em] ${UI.subheader}`}>{loc}</p>
                          <ul className="space-y-2 text-sm">
                            {events
                              .slice()
                              .sort((a, b) => a.start_time.localeCompare(b.start_time))
                              .slice(0, kiosk ? 10 : 8)
                              .map((ev) => (
                                <li
                                  key={ev.id}
                                  className="flex items-start justify-between gap-3 border border-ds-border bg-ds-secondary/40 px-4 py-3"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-ds-foreground">{ev.program_name}</p>
                                    {ev.staff?.length ? (
                                      <p className={`mt-0.5 truncate text-xs ${UI.subheader}`}>{ev.staff.join(", ")}</p>
                                    ) : null}
                                  </div>
                                  <span className={`shrink-0 text-xs font-bold tabular-nums ${UI.subheader}`}>
                                    {new Date(ev.start_time).toLocaleTimeString(undefined, {
                                      timeZone: BC_TZ,
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    –
                                    {new Date(ev.end_time).toLocaleTimeString(undefined, {
                                      timeZone: BC_TZ,
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                </DashboardAccentCard>
              </div>

              <div key="cadence" className={editMode ? "cursor-grab active:cursor-grabbing" : ""}>
                <DashboardColumnPanel
                  title="Ice & facility cadence"
                  accent="dusk"
                  className="h-full"
                  styleOverride={widgetStyles.cadence}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={cn(UI.header, "leading-snug")}>Set-ups • Ice cleans • Takedowns</p>
                      <p className={cn("mt-2 text-sm leading-relaxed", UI.subheader)}>
                        Placeholder schedule until Xplor Recreation API is connected.
                      </p>
                    </div>
                    {canEdit && editMode ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 min-w-0 px-0"
                          onClick={() => {
                            setStyleEditorTarget({ id: "cadence", title: "Ice & facility cadence" });
                            setStyleEditorOpen(true);
                          }}
                          aria-label="Widget style"
                          title="Widget style"
                        >
                          <Palette className="h-4 w-4" aria-hidden />
                        </Button>
                        <span className="dashboard-drag-handle mt-0.5 select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      </div>
                    ) : null}
                  </div>
                </DashboardColumnPanel>
              </div>

              <div key="notes" className={editMode ? "cursor-grab active:cursor-grabbing" : ""}>
                <DashboardColumnPanel title="Notes" accent="muted" className="h-full" styleOverride={widgetStyles.notes}>
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("text-sm leading-relaxed", UI.subheader)}>
                      This panel is intentionally “kiosk safe” (large text, high contrast). Next we can wire real-time data and
                      critical alerts into the modal above.
                    </p>
                    {canEdit && editMode ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 min-w-0 px-0"
                          onClick={() => {
                            setStyleEditorTarget({ id: "notes", title: "Notes" });
                            setStyleEditorOpen(true);
                          }}
                          aria-label="Widget style"
                          title="Widget style"
                        >
                          <Palette className="h-4 w-4" aria-hidden />
                        </Button>
                        <span className="dashboard-drag-handle mt-0.5 select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      </div>
                    ) : null}
                  </div>
                </DashboardColumnPanel>
              </div>
            </GridLayout>
          ) : null}
        </div>
      </div>

      {styleEditorOpen && styleEditorTarget ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4">
          <div className="ds-modal-backdrop absolute inset-0" onClick={() => setStyleEditorOpen(false)} aria-hidden />
          <Card className="relative z-10 w-full max-w-md border border-ds-border shadow-[var(--ds-shadow-diffuse)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ds-foreground">Widget style</p>
                <p className="mt-1 text-sm font-medium text-ds-muted">{styleEditorTarget.title}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setStyleEditorOpen(false)} className="h-9 px-3">
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Font</p>
                <select
                  className="app-field !py-2"
                  value={widgetStyles[styleEditorTarget.id]?.fontFamily ?? ""}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    setWidgetStyles((prev) => ({
                      ...prev,
                      [styleEditorTarget.id]: { ...(prev[styleEditorTarget.id] ?? {}), fontFamily: value },
                    }));
                  }}
                >
                  <option value="">Default</option>
                  <option value="var(--font-app), system-ui, sans-serif">Inter (app default)</option>
                  <option value="var(--font-headline), system-ui, sans-serif">Poppins</option>
                  <option value="system-ui, sans-serif">System</option>
                  <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Monospace</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Background</p>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-md border border-ds-border bg-transparent"
                    value={widgetStyles[styleEditorTarget.id]?.backgroundColor ?? "#ffffff"}
                    onChange={(e) => {
                      const value = e.target.value || undefined;
                      setWidgetStyles((prev) => ({
                        ...prev,
                        [styleEditorTarget.id]: { ...(prev[styleEditorTarget.id] ?? {}), backgroundColor: value },
                      }));
                    }}
                      aria-label="Widget background color"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Text color</p>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-md border border-ds-border bg-transparent"
                    value={widgetStyles[styleEditorTarget.id]?.textColor ?? "#4c5454"}
                    onChange={(e) => {
                      const value = e.target.value || undefined;
                      setWidgetStyles((prev) => ({
                        ...prev,
                        [styleEditorTarget.id]: { ...(prev[styleEditorTarget.id] ?? {}), textColor: value },
                      }));
                    }}
                    aria-label="Widget text color"
                  />
                </div>
              </div>

                <div className="rounded-xl border border-ds-border bg-ds-secondary/40 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Advanced theme</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(widgetStyles[styleEditorTarget.id]?.theme ?? "tint") !== "tint"}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setWidgetStyles((prev) => ({
                          ...prev,
                          [styleEditorTarget.id]: {
                            ...(prev[styleEditorTarget.id] ?? {}),
                            theme: checked ? (prev[styleEditorTarget.id]?.theme ?? "solid") : "tint",
                          },
                        }));
                      }}
                      aria-label="Enable advanced theme"
                    />
                  </label>
                  {(widgetStyles[styleEditorTarget.id]?.theme ?? "tint") !== "tint" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(["solid", "glass", "gradient"] as const).map((opt) => {
                        const active = (widgetStyles[styleEditorTarget.id]?.theme ?? "tint") === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={cn(
                              "rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition-colors",
                              active
                                ? "border-[var(--ds-accent)] bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-ds-foreground"
                                : "border-ds-border bg-transparent text-ds-muted hover:bg-ds-interactive-hover",
                            )}
                            onClick={() => {
                              setWidgetStyles((prev) => ({
                                ...prev,
                                [styleEditorTarget.id]: { ...(prev[styleEditorTarget.id] ?? {}), theme: opt },
                              }));
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setWidgetStyles((prev) => {
                      const next = { ...prev };
                      delete next[styleEditorTarget.id];
                      return next;
                    });
                  }}
                >
                  Reset to default
                </Button>
                <Button type="button" variant="primary" onClick={() => setStyleEditorOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

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

