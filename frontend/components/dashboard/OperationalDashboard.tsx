"use client";

import {
  AlertCircle,
  AlertTriangle,
  Battery,
  Check,
  Cloud,
  Info,
  MapPin,
  Maximize2,
  Minus,
  Package,
  Pencil,
  Plus,
  Radio,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GridLayout, noCompactor, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { DashboardAddWidgetWizard } from "@/components/dashboard/DashboardAddWidgetWizard";
import { DashboardCustomPeekWidget } from "@/components/dashboard/DashboardCustomPeekWidget";
import { XpTasksWidget } from "@/components/gamification/XpTasksWidget";
import { AdminOnboardingChecklist } from "@/components/onboarding/AdminOnboardingChecklist";
import { apiFetch, isApiMode } from "@/lib/api";
import { fetchOnboarding, fetchSetupProgress } from "@/lib/onboardingService";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseRoutes, pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { getServerDate, getServerNow } from "@/lib/serverTime";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import {
  DASHBOARD_CUSTOM_WIDGETS_STORAGE,
  DASHBOARD_LAYOUT_STORAGE_V1,
  DASHBOARD_LAYOUT_STORAGE_V2,
  type CustomDashboardWidgetConfig,
} from "@/lib/dashboardPageWidgetCatalog";
import {
  localScheduleDateKey,
  mergedScheduleShiftsForCalendarDate,
  shiftIntervalBoundsMs,
} from "@/lib/schedule/dashboardScheduleDay";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type AlertPriority = "critical" | "high" | "medium" | "low";

function WorkerDashCard({
  title,
  headerRight,
  children,
  className = "",
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary",
        className,
      ].join(" ")}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-headline text-base font-extrabold text-ds-foreground">{title}</p>
        {headerRight ? <div className="text-xs font-semibold text-ds-muted">{headerRight}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type AlertItem = {
  severity: "critical" | "warning";
  /** Finer ordering for the Active Alerts card; falls back from `severity` when omitted. */
  priority?: AlertPriority;
  title: string;
  subtitle?: string;
  /** When false, excluded from welcome / severity totals (padding rows, “all clear”, etc.). */
  countsTowardTotals?: boolean;
};

const BC_TZ = "America/Vancouver";
const NORTH_SAANICH = { lat: 48.6548, lon: -123.4207 };

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

function timeInBc(d: Date): string {
  return d.toLocaleTimeString(undefined, { timeZone: BC_TZ, hour: "2-digit", minute: "2-digit" });
}

function dateInBc(d: Date): string {
  return d.toLocaleDateString(undefined, { timeZone: BC_TZ, weekday: "long", month: "short", day: "numeric" });
}

/** Passed to `OperationalDashboard` `onReady` for welcome modal / other consumers. */
export type OperationalDashboardReadyPayload = {
  criticalCount: number;
  warningCount: number;
};

function alertCountsFromAlerts(alerts: AlertItem[]): OperationalDashboardReadyPayload {
  const real = alerts.filter((a) => a.countsTowardTotals !== false);
  return {
    criticalCount: real.filter((a) => alertPriority(a) === "critical").length,
    warningCount: real.filter((a) => {
      const p = alertPriority(a);
      return p === "high" || p === "medium" || p === "low";
    }).length,
  };
}

const NO_ACTIVE_ALERTS_TITLE = "No active alerts";
const NO_ADDITIONAL_ALERTS_TITLE = "No additional alerts";

function alertPriority(a: AlertItem): AlertPriority {
  if (a.priority) return a.priority;
  return a.severity === "critical" ? "critical" : "medium";
}

function alertPriorityRank(p: AlertPriority): number {
  switch (p) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 9;
  }
}

function compareAlerts(a: AlertItem, b: AlertItem): number {
  const dr = alertPriorityRank(alertPriority(a)) - alertPriorityRank(alertPriority(b));
  if (dr !== 0) return dr;
  return a.title.localeCompare(b.title);
}

/** Active Alerts card: always three rows, highest priority first; pad with neutral rows. */
function activeAlertCardRows(alerts: AlertItem[]): AlertItem[] {
  const real = alerts
    .filter((a) => a.countsTowardTotals !== false)
    .filter((a) => a.title !== NO_ACTIVE_ALERTS_TITLE)
    .slice()
    .sort(compareAlerts);

  const rows: AlertItem[] = [];

  if (real.length === 0) {
    rows.push({
      severity: "warning",
      priority: "low",
      title: NO_ACTIVE_ALERTS_TITLE,
      subtitle: "Operations look clear. New exceptions will surface here.",
      countsTowardTotals: false,
    });
  } else {
    for (const item of real.slice(0, 3)) rows.push(item);
  }

  while (rows.length < 3) {
    rows.push({
      severity: "warning",
      priority: "low",
      title: NO_ADDITIONAL_ALERTS_TITLE,
      subtitle: "No further high-priority exceptions in this snapshot.",
      countsTowardTotals: false,
    });
  }
  return rows.slice(0, 3);
}

function ActiveAlertsRow({ alert: a }: { alert: AlertItem }) {
  const p = alertPriority(a);
  const isPad = a.countsTowardTotals === false && a.title === NO_ADDITIONAL_ALERTS_TITLE;
  const accent =
    p === "critical"
      ? "ds-notification-critical"
      : p === "high"
        ? "ds-notification-warning"
        : p === "medium"
          ? ""
          : "ds-notification-muted";
  const style =
    p === "medium"
      ? ({
          borderLeftColor: "var(--ds-info)",
          background: "color-mix(in srgb, var(--ds-info) 12%, transparent)",
        } as const)
      : undefined;

  const icon =
    p === "critical" ? (
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
    ) : p === "high" ? (
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
    ) : p === "medium" ? (
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-info)]" aria-hidden />
    ) : isPad ? (
      <Minus className="mt-0.5 h-5 w-5 shrink-0 text-ds-muted" aria-hidden />
    ) : (
      <Radio className="mt-0.5 h-5 w-5 shrink-0 text-ds-muted" aria-hidden />
    );

  return (
    <li
      className={`ds-notification flex gap-3 p-4 ${accent}`.trim()}
      style={style}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${isPad ? "text-ds-muted" : "text-ds-foreground"}`}>{a.title}</p>
        {a.subtitle ? (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ds-muted">{a.subtitle}</p>
        ) : null}
      </div>
    </li>
  );
}

type WorkforceBubble = {
  id: string;
  initials: string;
  /** Shown under the avatar when a profile photo is displayed (contrasts with theme). */
  displayName: string;
  title: string;
  /**
   * Presence is future-facing (BLE / RTLS). For now, we default to `unknown` and
   * never treat unknown as off-site.
   */
  presence: {
    status: "on_site" | "off_site" | "unknown";
    lastSeen: number | null;
    lastZone: string | null;
  };
  /**
   * Last presence transition event. Off-site detection should be meaningful:
   * only set by explicit off-site presence OR an exit event (not a default bucket).
   */
  lastEvent: { type: "enter" | "exit"; timestamp: number } | null;
  /**
   * Worker scheduling bucket for the dashboard UI.
   * Note: "off_site" is not a fallback; only assign when presence/event indicates it.
   */
  scheduleBucket: "on_site" | "on_shift_now" | "upcoming_today" | "off_site" | null;
  /** Role chip: Manager / Supervisor / Lead (workers have no badge). */
  badge?: "M" | "S" | "L";
  /** Sort key: 0 = manager tier … 3 = worker. */
  roleSortRank: number;
  avatar_url?: string | null;
};

type WorkTag = { kind: "progress" | "overdue" | "urgent"; label: string };

export type DashboardViewModel = {
  title: string;
  welcomeName: string;
  /** Short banner when demo or guided telemetry is active for this tenant. */
  bannerNote: string | null;
  alerts: AlertItem[];
  workforce: {
    dateLabel: string;
    summaryLine: string;
    onSite: WorkforceBubble[];
    onShiftNow: WorkforceBubble[];
    upcomingToday: WorkforceBubble[];
    /** On the month grid for today but not in on-site / on-shift / upcoming / off-site buckets (e.g. finished shift, PTO chip). */
    onScheduleToday: WorkforceBubble[];
    offSite: WorkforceBubble[];
    counts: { onSite: number; onShiftNow: number; upcomingToday: number; onScheduleToday: number; offSite: number };
  };
  workRequests: {
    awaitingCount: number;
    newest: { title: string; subtitle: string; tag: WorkTag } | null;
    oldest: { title: string; subtitle: string; tag: WorkTag } | null;
    critical: { title: string; subtitle: string }[];
  };
  equipment: {
    activeCount: number;
    missingCount: number;
    outOfServiceCount: number;
    showZonePrompt: boolean;
    showBatteryNote: boolean;
  };
  inventory: {
    consumablesOk: boolean;
    alert: { category: string; message: string } | null;
    shoppingList: string[];
  };
};

const roleBadgeBase =
  "pointer-events-none absolute -top-0.5 -right-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold leading-none text-ds-on-accent shadow-[var(--ds-shadow-card)] ring-2 ring-[var(--ds-surface-primary)]";

/** Dashboard workforce bubbles: gold fill + black initials; photo replaces initials when `avatar_url` resolves. */
const workforceAvatarGoldBase =
  "rounded-full bg-ds-warning font-bold text-ds-on-accent shadow-sm ring-1 ring-black/20 ring-offset-2 ring-offset-[var(--ds-surface-primary)]";

function workforceRoleBadgeAndRank(role: string): { badge?: "M" | "S" | "L"; rank: number } {
  const r = role.toLowerCase();
  if (r === "manager" || r === "company_admin") return { badge: "M", rank: 0 };
  if (r === "supervisor") return { badge: "S", rank: 1 };
  if (r === "lead") return { badge: "L", rank: 2 };
  return { rank: 3 };
}

function sortWorkforceByRoleThenName(a: WorkforceBubble, b: WorkforceBubble): number {
  const d = a.roleSortRank - b.roleSortRank;
  if (d !== 0) return d;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
}

function onsiteAvatarClass() {
  return `relative flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs transition-transform md:h-12 md:w-12 md:text-sm`;
}

function offsiteAvatarClass() {
  return `relative flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs md:h-12 md:w-12 md:text-sm`;
}

function scheduledAvatarClass() {
  return `relative flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs md:h-12 md:w-12 md:text-sm`;
}

function WorkforceRoleLetterBadge({ letter }: { letter: "M" | "S" | "L" }) {
  return (
    <span className={`${roleBadgeBase} bg-ds-success`} aria-hidden>
      {letter}
    </span>
  );
}

function WorkforceStatusDot({
  color,
}: {
  color: "green" | "yellow" | "gray";
}) {
  const bg =
    color === "green"
      ? "bg-ds-success"
      : color === "yellow"
        ? "bg-[var(--ds-info)]"
        : "bg-ds-muted";
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 z-10 h-2.5 w-2.5 rounded-full ${bg} ring-2 ring-[var(--ds-surface-primary)]`}
      aria-hidden
    />
  );
}

function WorkforceUpcomingPill() {
  return (
    <span className="absolute -bottom-1 -right-1 z-10 rounded-full border border-ds-border bg-ds-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ds-muted ring-2 ring-[var(--ds-surface-primary)]">
      Upcoming
    </span>
  );
}

function WorkforceBubbleFaceContent({
  initials,
  resolvedSrc,
  photoAlt,
}: {
  initials: string;
  resolvedSrc: string | null;
  /** Accessible name when a profile photo is shown */
  photoAlt?: string;
}) {
  if (resolvedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedSrc}
        alt={photoAlt?.trim() ? photoAlt : ""}
        className="h-full w-full rounded-full object-cover object-center"
      />
    );
  }
  return <>{initials}</>;
}

function WorkforceBubbleStack({
  bubble,
  faceClassName,
  badges,
}: {
  bubble: WorkforceBubble;
  faceClassName: string;
  badges?: ReactNode;
}) {
  const resolvedSrc = useResolvedAvatarSrc(bubble.avatar_url ?? null);
  const showName = Boolean(resolvedSrc && bubble.displayName.trim());

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span title={bubble.title} className={faceClassName}>
        <WorkforceBubbleFaceContent
          initials={bubble.initials}
          resolvedSrc={resolvedSrc}
          photoAlt={bubble.displayName}
        />
        {badges}
      </span>
      {showName ? (
        <span className="max-w-[6.5rem] truncate text-center text-[10px] font-semibold leading-tight text-black dark:text-white">
          {bubble.displayName}
        </span>
      ) : null}
    </span>
  );
}

function initialsFromUser(email: string, fullName: string | null | undefined): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

function welcomeFromSession(email: string | null | undefined, fullName: string | null | undefined): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

function demoModel(): DashboardViewModel {
  return {
    title: "Operations Dashboard",
    welcomeName: "Alex",
    bannerNote: null,
    alerts: [
      {
        severity: "critical",
        priority: "critical",
        title: "Missing Hammer Drill",
        subtitle: "Last seen: Boiler Room\nZone 3 (Garage)",
      },
      {
        severity: "warning",
        priority: "high",
        title: "Zone 3 (Garage) Offline",
        subtitle: "Status: Planned",
      },
      {
        severity: "warning",
        priority: "medium",
        title: "Low Beacon Battery",
        subtitle: "Zone 2 anchor · swap pack before next shift",
      },
    ],
    workforce: {
      dateLabel: getServerDate().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      summaryLine: "9 scheduled today",
      onSite: [
        {
          id: "0",
          initials: "TC",
          displayName: "Taylor Cruz",
          title: "Site manager · On site",
          presence: { status: "on_site", lastSeen: Date.now() - 1000 * 60 * 2, lastZone: "Zone 1" },
          lastEvent: { type: "enter", timestamp: Date.now() - 1000 * 60 * 12 },
          scheduleBucket: "on_site",
          badge: "M",
          roleSortRank: 0,
        },
      ],
      onShiftNow: [
        {
          id: "2",
          initials: "AR",
          displayName: "Avery Rowe",
          title: "Supervisor · On shift now",
          presence: { status: "unknown", lastSeen: null, lastZone: null },
          lastEvent: null,
          scheduleBucket: "on_shift_now",
          badge: "S",
          roleSortRank: 1,
        },
      ],
      upcomingToday: [
        {
          id: "1",
          initials: "MR",
          displayName: "Morgan Reid",
          title: "Site lead · Upcoming today",
          presence: { status: "unknown", lastSeen: null, lastZone: null },
          lastEvent: null,
          scheduleBucket: "upcoming_today",
          badge: "L",
          roleSortRank: 2,
        },
      ],
      onScheduleToday: [],
      offSite: [
        {
          id: "7",
          initials: "RW",
          displayName: "River Walsh",
          title: "Technician · Off site",
          presence: { status: "unknown", lastSeen: null, lastZone: null },
          lastEvent: { type: "exit", timestamp: Date.now() - 1000 * 60 * 35 },
          scheduleBucket: "off_site",
          roleSortRank: 3,
        },
      ],
      counts: { onSite: 1, onShiftNow: 1, upcomingToday: 1, onScheduleToday: 0, offSite: 1 },
    },
    workRequests: {
      awaitingCount: 7,
      newest: {
        title: "Cooling Pump Skid 7",
        subtitle: "Seal leak on secondary — WR-8910",
        tag: { kind: "progress", label: "In progress" },
      },
      oldest: {
        title: "Industrial Lift 2",
        subtitle: "Annual inspection certification · WR-8894",
        tag: { kind: "overdue", label: "Overdue" },
      },
      critical: [
        { title: "Sprinkler Test Riser", subtitle: "Quarterly flow test documentation pending · WR-8755" },
        { title: "HVAC Compressor #4", subtitle: "Vibration past threshold — bearing inspection · WR-8921" },
        { title: "Main Power Panel", subtitle: "Thermal scan follow-up escalated · WR-8840" },
      ],
    },
    equipment: {
      activeCount: 67,
      missingCount: 2,
      outOfServiceCount: 1,
      showZonePrompt: true,
      showBatteryNote: true,
    },
    inventory: {
      consumablesOk: true,
      alert: {
        category: "Plumbing",
        message: "Resupply needed in 7 days",
      },
      shoppingList: ["Plumbing fittings", "Pipe sealant", "Replacement valves"],
    },
  };
}

type DashboardPayload = {
  active_workers: number;
  open_work_requests: number;
  low_stock_items: number;
  shifts_today: number;
  alerts: string[];
};

type WorkRequestOut = {
  id: string;
  title: string;
  description: string | null;
  /** String level from API (`low` | `medium` | `high` | `critical`); legacy numeric still accepted. */
  priority: number | string;
  status: string;
  assigned_user_id: string | null;
  updated_at: string;
  due_date?: string | null;
};

type WorkRequestListOut = { items: WorkRequestOut[]; total: number };

type WorkerOut = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  roles?: string[];
  avatar_url?: string | null;
  employment_type?: string | null;
  recurring_shifts?: PulseWorkerApi["recurring_shifts"] | null;
  /**
   * Future BLE / RTLS integration.
   * Not currently returned by the API in most environments, so treated as optional.
   */
  presence?: {
    status?: "on_site" | "off_site" | "unknown";
    lastSeen?: string | number | null;
    lastZone?: string | null;
  };
  lastEvent?: {
    type?: "enter" | "exit";
    timestamp?: string | number | null;
  };
};

type ShiftOut = {
  id: string;
  assigned_user_id: string;
  starts_at: string;
  ends_at: string;
} & Partial<Omit<PulseShiftApi, "id" | "assigned_user_id" | "starts_at" | "ends_at">>;

type AssetOut = {
  id: string;
  name: string;
  zone_id: string | null;
  status: string;
};

type InventoryItemOut = {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
};

type ZoneOut = { id: string; name: string };

type BeaconEquipmentOut = { id: string };

function priorityRank(p: number | string): number {
  if (typeof p === "number") return p;
  switch (String(p).toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function workRequestTag(w: WorkRequestOut): WorkTag {
  const st = w.status.toLowerCase();
  const pr = priorityRank(w.priority);
  if (st === "completed") return { kind: "progress", label: "Completed" };
  if (st === "cancelled") return { kind: "progress", label: "Cancelled" };
  const due = w.due_date ? new Date(w.due_date).getTime() : null;
  if (due != null && due < getServerNow()) return { kind: "overdue", label: "Overdue" };
  if (st === "in_progress") return { kind: "progress", label: "In progress" };
  if (pr >= 3) return { kind: "urgent", label: "Urgent" };
  return { kind: "progress", label: st.replace(/_/g, " ") };
}

/** Local calendar day [start, end) in ms, aligned with schedule fetch and `dateLabel` (not UTC midnight). */
function localCalendarDayBoundsMs(nowMs: number): { dayStartMs: number; dayEndMsExclusive: number } {
  const anchor = new Date(nowMs);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEndExclusive = new Date(dayStart);
  dayEndExclusive.setDate(dayEndExclusive.getDate() + 1);
  return { dayStartMs: dayStart.getTime(), dayEndMsExclusive: dayEndExclusive.getTime() };
}

function buildLiveModel(
  dashboard: DashboardPayload,
  wr: WorkRequestListOut,
  workers: WorkerOut[],
  shifts: ShiftOut[],
  assets: AssetOut[],
  lowStock: InventoryItemOut[],
  zones: ZoneOut[],
  beacons: BeaconEquipmentOut[],
): DashboardViewModel {
  const zoneName = (id: string | null) => (id ? zones.find((z) => z.id === id)?.name ?? "Unknown zone" : "Unassigned");

  const now = getServerNow();
  const { dayEndMsExclusive } = localCalendarDayBoundsMs(now);
  const dateKey = localScheduleDateKey(now);

  const apiBoundsById = new Map<string, Pick<PulseShiftApi, "starts_at" | "ends_at">>();
  for (const s of shifts) {
    apiBoundsById.set(s.id, { starts_at: s.starts_at, ends_at: s.ends_at });
  }

  const dayMerged = mergedScheduleShiftsForCalendarDate({
    dateStr: dateKey,
    pulseShifts: shifts as PulseShiftApi[],
    pulseWorkers: workers as PulseWorkerApi[],
    pulseZones: zones,
  });

  const workerById = new Map(workers.map((w) => [w.id, w]));
  const scheduledIdsOnCalendar = new Set(
    dayMerged.map((s) => s.workerId).filter((id): id is string => Boolean(id)),
  );
  /** Same people as month cells: anyone assigned that day who exists in the Pulse workers list. */
  const scheduledWorkers = [...scheduledIdsOnCalendar]
    .map((id) => workerById.get(id))
    .filter((w): w is WorkerOut => w != null);

  const bubbles: WorkforceBubble[] = scheduledWorkers.map((w) => {
    const initials = initialsFromUser(w.email, w.full_name);
    const mineRows = dayMerged.filter((s) => s.workerId === w.id);
    const intervals = mineRows
      .map((s) => shiftIntervalBoundsMs(s, apiBoundsById))
      .filter((iv): iv is { startMs: number; endMs: number } => iv != null);
    const active = intervals.some((iv) => iv.startMs <= now && now < iv.endMs);
    const nextStart =
      intervals.length === 0 ? null : Math.min(...intervals.map((iv) => iv.startMs));

    const parseTs = (value: string | number | null | undefined): number | null => {
      if (value == null) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const t = new Date(value).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const presence: WorkforceBubble["presence"] = {
      status: w.presence?.status ?? "unknown",
      lastSeen: parseTs(w.presence?.lastSeen),
      lastZone: w.presence?.lastZone ?? null,
    };

    const lastEvent: WorkforceBubble["lastEvent"] =
      w.lastEvent?.type && (w.lastEvent.type === "enter" || w.lastEvent.type === "exit")
        ? {
            type: w.lastEvent.type,
            timestamp: parseTs(w.lastEvent.timestamp) ?? now,
          }
        : null;

    const isUpcomingToday = nextStart != null && now < nextStart && nextStart < dayEndMsExclusive;

    const isOffSite = presence.status === "off_site" || lastEvent?.type === "exit";

    const scheduleBucket: WorkforceBubble["scheduleBucket"] | null =
      presence.status === "on_site"
        ? "on_site"
        : active
          ? "on_shift_now"
          : isUpcomingToday
            ? "upcoming_today"
            : isOffSite
              ? "off_site"
              : null;

    // NOTE: Workers who are scheduled today but have finished their shift and have unknown presence
    // should not be defaulted into "Off Site". We also avoid introducing a "fallback" bucket, so
    // those workers will be omitted from all groups (see grouping below) until presence/event data exists.
    const titleBase = `${w.full_name ?? w.email}`;
    const title =
      scheduleBucket === "on_site"
        ? `${titleBase} · On site`
        : scheduleBucket === "on_shift_now"
          ? `${titleBase} · On shift now`
          : scheduleBucket === "upcoming_today"
            ? `${titleBase} · Upcoming today`
            : scheduleBucket === "off_site"
              ? `${titleBase} · Off site`
              : `${titleBase} · Scheduled today`;

    const { badge, rank: roleSortRank } = workforceRoleBadgeAndRank(w.role);
    const displayName = w.full_name?.trim() || w.email.split("@")[0] || w.email;
    return {
      id: w.id,
      initials,
      displayName,
      title,
      presence,
      lastEvent,
      scheduleBucket,
      badge,
      roleSortRank,
      avatar_url: w.avatar_url,
    };
  });

  const onSite = bubbles
    .filter((b) => b.presence.status === "on_site")
    .sort(sortWorkforceByRoleThenName);
  const onShiftNow = bubbles
    .filter((b) => b.presence.status !== "on_site")
    .filter((b) => b.scheduleBucket === "on_shift_now")
    .sort(sortWorkforceByRoleThenName);
  const upcomingToday = bubbles
    .filter((b) => b.scheduleBucket === "upcoming_today")
    .filter((b) => b.presence.status !== "on_site")
    .sort(sortWorkforceByRoleThenName);
  const offSite = bubbles
    .filter((b) => b.presence.status === "off_site" || b.lastEvent?.type === "exit")
    .sort(sortWorkforceByRoleThenName);

  const onScheduleToday = bubbles
    .filter(
      (b) =>
        b.scheduleBucket === null &&
        b.presence.status !== "off_site" &&
        b.lastEvent?.type !== "exit",
    )
    .sort(sortWorkforceByRoleThenName);

  const scheduledCount = scheduledIdsOnCalendar.size;

  const summaryLine = `${scheduledCount} scheduled today`;

  const openItems = wr.items.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const unassigned = wr.items.filter((i) => !i.assigned_user_id && i.status === "open").length;
  const sortedByNew = [...openItems].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const sortedByOld = [...openItems].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  );
  const critical = [...openItems]
    .filter((i) => priorityRank(i.priority) >= 3)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 4)
    .map((i) => ({
      title: i.title,
      subtitle: (i.description ?? `WR · ${i.id.slice(0, 8)}…`).slice(0, 120),
    }));

  const newest =
    sortedByNew[0] != null
      ? {
          title: sortedByNew[0].title,
          subtitle:
            sortedByNew[0].description ??
            `${sortedByNew[0].status.replace(/_/g, " ")} · updated recently`,
          tag: workRequestTag(sortedByNew[0]),
        }
      : null;

  const oldest =
    sortedByOld[0] != null && sortedByOld[0].id !== sortedByNew[0]?.id
      ? {
          title: sortedByOld[0].title,
          subtitle:
            sortedByOld[0].description ??
            `${sortedByOld[0].status.replace(/_/g, " ")} · awaiting action`,
          tag: workRequestTag(sortedByOld[0]),
        }
      : sortedByOld[1] != null
        ? {
            title: sortedByOld[1].title,
            subtitle:
              sortedByOld[1].description ??
              `${sortedByOld[1].status.replace(/_/g, " ")} · awaiting action`,
            tag: workRequestTag(sortedByOld[1]),
          }
        : null;

  const missingTools = assets.filter((a) => a.status === "missing");
  const oos = assets.filter((a) => a.status === "maintenance");
  const activeTools = assets.filter((a) => a.status === "available" || a.status === "assigned");

  const alerts: AlertItem[] = [];
  for (const t of missingTools.slice(0, 3)) {
    alerts.push({
      severity: "critical",
      priority: "critical",
      title: `Missing · ${t.name}`,
      subtitle: `Last known zone: ${zoneName(t.zone_id)}`,
    });
  }
  for (const t of oos.slice(0, 2)) {
    alerts.push({
      severity: "warning",
      priority: "high",
      title: `Out of service · ${t.name}`,
      subtitle: `Zone: ${zoneName(t.zone_id)}`,
    });
  }
  for (const row of lowStock.slice(0, 3)) {
    alerts.push({
      severity: "warning",
      priority: "low",
      title: `Low stock · ${row.name}`,
      subtitle: `Qty ${row.quantity} at or below threshold (${row.low_stock_threshold} ${"units"})`,
    });
  }
  for (const msg of dashboard.alerts) {
    if (alerts.length >= 8) break;
    alerts.push({ severity: "warning", priority: "medium", title: msg });
  }
  if (alerts.length === 0) {
    alerts.push({
      severity: "warning",
      priority: "low",
      title: NO_ACTIVE_ALERTS_TITLE,
      subtitle: "Operations look clear. New exceptions will surface here.",
      countsTowardTotals: false,
    });
  }

  const invAlert =
    lowStock[0] != null
      ? {
          category: lowStock[0].name.split(/[\s/]/)[0] ?? "Inventory",
          message: `Resupply soon — ${lowStock[0].name} at or below threshold`,
        }
      : null;

  return {
    title: "Operations Dashboard",
    welcomeName: "",
    bannerNote: null,
    alerts,
    workforce: {
      dateLabel: getServerDate().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      summaryLine,
      onSite,
      onShiftNow,
      upcomingToday,
      onScheduleToday,
      offSite,
      counts: {
        onSite: onSite.length,
        onShiftNow: onShiftNow.length,
        upcomingToday: upcomingToday.length,
        onScheduleToday: onScheduleToday.length,
        offSite: offSite.length,
      },
    },
    workRequests: {
      awaitingCount: unassigned || openItems.filter((i) => i.status === "open").length,
      newest,
      oldest,
      critical,
    },
    equipment: {
      activeCount: activeTools.length,
      missingCount: missingTools.length,
      outOfServiceCount: oos.length,
      showZonePrompt: assets.some((a) => a.status === "assigned"),
      showBatteryNote: beacons.length > 0,
    },
    inventory: {
      consumablesOk: dashboard.low_stock_items === 0,
      alert: invAlert,
      shoppingList: lowStock.slice(0, 6).map((i) => i.name),
    },
  };
}

function TagPill({ tag }: { tag: WorkTag }) {
  if (tag.kind === "progress") {
    return (
      <span className="app-badge-blue shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {tag.label}
      </span>
    );
  }
  if (tag.kind === "overdue") {
    return (
      <span className="app-badge-amber shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
        {tag.label}
      </span>
    );
  }
  return (
    <span className="app-badge-red shrink-0 self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
      {tag.label}
    </span>
  );
}

function headerInitials(welcomeName: string): string {
  const t = welcomeName.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

const ADMIN_SETUP_BANNER_DISMISS_KEY = "pulse_admin_setup_banner_dismissed";

function OperationsHeaderLogoMark({
  logoUrl,
  companyName,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
}) {
  const raw = logoUrl?.trim() || null;
  const isExternal = Boolean(raw && (raw.startsWith("http://") || raw.startsWith("https://")));
  // Public Next.js assets (e.g. `/images/panologo.png`) should NOT be fetched with bearer auth.
  const isPublicLocal = Boolean(raw && raw.startsWith("/") && !raw.startsWith("/api"));
  const internal = raw && !isExternal && !isPublicLocal ? raw : null;
  const resolved = useAuthenticatedAssetSrc(internal);
  const src = !raw ? null : isExternal || isPublicLocal ? raw : resolved;
  const waiting = Boolean(internal && !src);
  const initials = headerInitials(companyName ?? "");

  return (
    <div
      className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ds-border bg-ds-surface-primary shadow-[var(--ds-shadow-card)]"
      title={(companyName?.trim() || "Company").slice(0, 48)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob or tenant https URL
        <img src={src} alt="" className="max-h-[2.75rem] max-w-[2.75rem] object-contain" />
      ) : waiting ? (
        <span className="h-8 w-8 animate-pulse rounded-md bg-ds-secondary" aria-hidden />
      ) : (
        <span className="px-1 text-center text-xs font-bold leading-tight text-ds-foreground">
          {initials}
        </span>
      )}
    </div>
  );
}

function DashboardBody({
  model,
  workOrdersHref,
  hideHeaderWelcome,
  zonePromptDismissed,
  onDismissZonePrompt,
  headerLogoUrl,
  headerCompanyName,
  facilitySetupChecklist,
  readOnly = false,
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
  hideHeaderWelcome?: boolean;
  zonePromptDismissed?: boolean;
  onDismissZonePrompt?: () => void;
  /** Tenant logo for Operations header center (API path or https). */
  headerLogoUrl?: string | null;
  headerCompanyName?: string | null;
  facilitySetupChecklist?: ReactNode;
  readOnly?: boolean;
}) {
  const pathname = usePathname();
  const isKiosk = pathname.startsWith("/kiosk/");
  const openKiosk = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(`${window.location.origin}/kiosk/overview`, "_blank", "noopener,noreferrer");
  }, []);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather>({ tempC: null, code: null, windKph: null });

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
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
  const userInitials = headerInitials(model.welcomeName);
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (readOnly) setEditMode(false);
  }, [readOnly]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showPeekWizard, setShowPeekWizard] = useState(false);
  const [peekWizardMode, setPeekWizardMode] = useState<"create" | "edit">("create");
  const [peekWizardInitial, setPeekWizardInitial] = useState<CustomDashboardWidgetConfig | null>(null);
  const [customConfigs, setCustomConfigs] = useState<Record<string, CustomDashboardWidgetConfig>>({});
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const activeAlertRows = useMemo(() => activeAlertCardRows(model.alerts), [model.alerts]);

  const widgetRegistry = useMemo(() => {
    return {
      alerts: {
        title: "Active Alerts",
        accent: "yellow" as const,
        render: () => (
          <ul className="flex flex-1 flex-col gap-3">
            {activeAlertRows.map((a, idx) => (
              <ActiveAlertsRow key={`${a.title}-${idx}`} alert={a} />
            ))}
          </ul>
        ),
      },
      workforce: {
        title: "Workforce",
        accent: "blue" as const,
        render: () => (
          <>
            <p className="text-sm font-semibold text-ds-foreground">Today – {model.workforce.dateLabel}</p>
            <p className="mt-2 text-xs text-ds-muted">{model.workforce.summaryLine}</p>

            <div className="mt-4 space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-success">
                  On Site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onSite.length === 0 ? (
                    <p className="text-sm text-ds-muted">No workers currently on site</p>
                  ) : (
                    model.workforce.onSite.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={onsiteAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            <WorkforceStatusDot color="green" />
                          </>
                        }
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ds-info)]">
                  On Shift Now
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onShiftNow.length === 0 ? (
                    <p className="text-sm text-ds-muted">—</p>
                  ) : (
                    model.workforce.onShiftNow.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={scheduledAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            <WorkforceStatusDot color="yellow" />
                          </>
                        }
                      />
                    ))
                  )}
                </div>
              </div>

              {model.workforce.upcomingToday.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ds-info)]">
                    Upcoming Today
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {model.workforce.upcomingToday.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={scheduledAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            <WorkforceUpcomingPill />
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {model.workforce.onScheduleToday.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    On today&apos;s schedule
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {model.workforce.onScheduleToday.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={scheduledAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            <WorkforceStatusDot color="yellow" />
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {model.workforce.offSite.length > 0 ? (
                <div className="space-y-3 border-t border-ds-border pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Off Site</p>
                  <div className="flex flex-wrap gap-3 opacity-90">
                    {model.workforce.offSite.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={offsiteAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            <WorkforceStatusDot color="gray" />
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ),
      },
      workRequests: {
        title: "Work Requests",
        accent: "red" as const,
        render: () => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-ds-border bg-ds-interactive-hover px-3 py-1 text-xs font-bold tracking-tight text-ds-foreground">
                {model.workRequests.awaitingCount} requests awaiting assignment
              </span>
            </div>
            <p className="mt-2 text-xs">
              <Link href={workOrdersHref} className="ds-link">
                Open work orders view →
              </Link>
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {model.workRequests.newest ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Newest</p>
                  <div className="mt-2 rounded-md border border-ds-border bg-transparent p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ds-foreground">{model.workRequests.newest.title}</p>
                        <p className="mt-1 text-xs text-ds-muted">{model.workRequests.newest.subtitle}</p>
                      </div>
                      <TagPill tag={model.workRequests.newest.tag} />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ds-muted">
                  No open work requests yet.{" "}
                  <Link href={workOrdersHref} className="ds-link">
                    Open work orders
                  </Link>{" "}
                  to create the first tracked item.
                </p>
              )}

              {model.workRequests.oldest ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Oldest</p>
                  <div className="mt-2 rounded-md border border-ds-border bg-transparent p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ds-foreground">{model.workRequests.oldest.title}</p>
                        <p className="mt-1 text-xs text-ds-muted">{model.workRequests.oldest.subtitle}</p>
                      </div>
                      <TagPill tag={model.workRequests.oldest.tag} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-danger">
                  High priority / Critical
                </p>
                {model.workRequests.critical.length === 0 ? (
                  <p className="mt-2 text-sm text-ds-muted">No high-priority items right now.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {model.workRequests.critical.map((row) => (
                      <li key={row.title} className="ds-notification ds-notification-critical flex gap-3 p-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ds-foreground">{row.title}</p>
                          <p className="mt-0.5 text-xs text-ds-muted">{row.subtitle}</p>
                        </div>
                        <span className="app-badge-red shrink-0 self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                          Urgent
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        ),
      },
      equipment: {
        title: "Equipment Update",
        accent: "none" as const,
        render: () => (
          <>
            <p className="text-2xl font-bold tabular-nums text-ds-foreground md:text-3xl">
              {model.equipment.activeCount} Active Tools
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ds-border bg-ds-interactive-hover px-3 py-1 text-xs font-semibold text-ds-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
                {model.equipment.missingCount} Missing
              </span>
              <span className="app-badge-red inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
                {model.equipment.outOfServiceCount} Out of Service
              </span>
            </div>
            <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-ds-border pt-4">
              {model.equipment.showZonePrompt && !zonePromptDismissed ? (
                <div className="ds-notification ds-notification-warning p-4">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-ds-foreground">
                        Several tools are accounted for, but may need zone checks.
                      </p>
                      <p className="mt-1 text-xs text-ds-muted">Schedule a cleanup?</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={
                            pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"
                          }
                          className="ds-btn-solid-primary inline-flex px-3 py-1.5 text-xs"
                        >
                          Review inventory
                        </Link>
                        <button
                          type="button"
                          onClick={onDismissZonePrompt}
                          className="ds-btn-secondary px-3 py-1.5 text-xs"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {model.equipment.showBatteryNote ? (
                <div className="ds-notification ds-notification-muted p-4">
                  <div className="flex gap-3">
                    <Battery className="mt-0.5 h-5 w-5 shrink-0 text-ds-muted" aria-hidden />
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-ds-foreground">
                      Beacon equipment registered — confirm batteries and swaps on the floor before the next shift.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ),
      },
      inventory: {
        title: "Inventory Status",
        accent: "green" as const,
        render: () => (
          <div className="mt-1 flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-md border border-ds-border bg-transparent p-4">
              <div>
                <p className="text-sm font-semibold text-ds-foreground">Consumables</p>
                <p className="mt-1 text-xs text-ds-muted">
                  {model.inventory.consumablesOk ? "Stock within target range" : "One or more items need attention"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  model.inventory.consumablesOk
                    ? "border border-ds-border bg-ds-interactive-hover text-ds-foreground"
                    : "border border-ds-border bg-ds-secondary text-[var(--ds-info)]"
                }`}
              >
                {model.inventory.consumablesOk ? "OK" : "Review"}
              </span>
            </div>

            {model.inventory.alert ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Inventory Alert</p>
                <div className="ds-notification ds-notification-warning mt-3 flex items-start justify-between gap-4 p-4">
                  <Package className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ds-foreground">{model.inventory.alert.category}</p>
                    <p className="mt-2 text-xs font-medium text-ds-foreground">{model.inventory.alert.message}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-ds-border bg-ds-secondary px-2 py-0.5 text-[11px] font-semibold text-[var(--ds-info)]">
                    Soon
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="ds-btn-secondary px-3 py-1.5 text-xs"
                  >
                    View stock
                  </Link>
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="ds-btn-solid-primary inline-flex px-3 py-1.5 text-xs"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ds-muted">No low-stock alerts.</p>
            )}

            <div className="border-t border-ds-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Shopping List</p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-3 text-sm text-ds-muted">Add items from low-stock alerts.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {model.inventory.shoppingList.map((item) => (
                    <li
                      key={item}
                      className="ds-table-row-hover flex cursor-default items-center gap-2 rounded-md border border-ds-border bg-transparent px-3 py-2 text-sm text-ds-foreground"
                    >
                      <span className="flex h-4 w-4 shrink-0 rounded border border-ds-border bg-transparent" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ),
      },
      xp: {
        title: "Tasks",
        accent: "none" as const,
        // XP is shown in Profile (subtle WoW-style bar); keep tasks here for quick action.
        render: () => <XpTasksWidget />,
      },
      setup: facilitySetupChecklist
        ? {
            title: "Setup checklist",
            accent: "none" as const,
            render: () => facilitySetupChecklist,
          }
        : null,
    } as const;
  }, [
    activeAlertRows,
    facilitySetupChecklist,
    model,
    onDismissZonePrompt,
    pulseTenantNav,
    workOrdersHref,
    zonePromptDismissed,
  ]);

  const allWidgetKeys = useMemo(() => {
    return Object.keys(widgetRegistry).filter((k) => (widgetRegistry as Record<string, unknown>)[k] != null);
  }, [widgetRegistry]);

  const defaultLayout = useMemo((): Layout => {
    const base: Layout = [
      { i: "alerts", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
      // Three-up row so Equipment can sit beside Workforce + Inventory.
      { i: "workforce", x: 0, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      { i: "inventory", x: 4, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      { i: "equipment", x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      // Full-width row for the detailed list card.
      { i: "workRequests", x: 0, y: 7, w: 12, h: 4, minW: 6, minH: 3 },
      { i: "xp", x: 0, y: 11, w: 12, h: 3, minW: 6, minH: 2 },
    ];
    return widgetRegistry.setup
      ? ([{ i: "setup", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 }, ...base] as const)
      : base;
  }, [widgetRegistry.setup]);

  const [layout, setLayout] = useState<Layout>(defaultLayout);

  // Load saved layout (v2) and custom peek configs; migrate legacy v1 layout once.
  useEffect(() => {
    let parsedConfigs: Record<string, CustomDashboardWidgetConfig> = {};
    try {
      const cw = window.localStorage.getItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE);
      if (cw) parsedConfigs = JSON.parse(cw) as Record<string, CustomDashboardWidgetConfig>;
    } catch {
      parsedConfigs = {};
    }

    let nextLayout: Layout | null = null;
    try {
      const v2 = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_V2);
      if (v2) nextLayout = JSON.parse(v2) as Layout;
    } catch {
      nextLayout = null;
    }
    if (!nextLayout) {
      try {
        const v1 = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_V1);
        if (v1) {
          nextLayout = JSON.parse(v1) as Layout;
          try {
            window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_V2, v1);
          } catch {
            /* ignore */
          }
        }
      } catch {
        nextLayout = null;
      }
    }
    if (!nextLayout) nextLayout = defaultLayout;

    const validBuiltins = new Set(allWidgetKeys);
    const filtered: LayoutItem[] = [];
    for (const l of nextLayout) {
      if (!l || typeof l.i !== "string") continue;
      if (l.i.startsWith("cw_")) {
        if (parsedConfigs[l.i]) filtered.push(l);
      } else if (validBuiltins.has(l.i)) {
        filtered.push(l);
      }
    }
    const present = new Set(filtered.map((x) => x.i));
    const missing = defaultLayout.filter((l) => !present.has(l.i));
    setLayout([...filtered, ...missing] as Layout);
    setCustomConfigs(parsedConfigs);
    setLayoutHydrated(true);
  }, [allWidgetKeys, defaultLayout]);

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_V2, JSON.stringify(layout));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [layout, layoutHydrated]);

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      window.localStorage.setItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE, JSON.stringify(customConfigs));
    } catch {
      /* ignore */
    }
  }, [customConfigs, layoutHydrated]);

  const layoutKeys = useMemo(() => new Set(layout.map((l) => l.i)), [layout]);
  const availableToAdd = useMemo(() => allWidgetKeys.filter((k) => !layoutKeys.has(k)), [allWidgetKeys, layoutKeys]);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => prev.filter((l) => l.i !== id));
    if (id.startsWith("cw_")) {
      setCustomConfigs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const addWidget = useCallback(
    (id: string) => {
      if (layoutKeys.has(id)) return;
      const base = defaultLayout.find((l) => l.i === id);
      const next: LayoutItem = base ?? { i: id, x: 0, y: Infinity, w: 6, h: 3 };
      setLayout((prev) => [...prev, { ...next, x: 0, y: Infinity }]);
    },
    [defaultLayout, layoutKeys],
  );

  const saveCustomPeek = useCallback((config: CustomDashboardWidgetConfig, layoutItem: LayoutItem | null) => {
    setCustomConfigs((prev) => ({ ...prev, [config.id]: config }));
    if (layoutItem) setLayout((prev) => [...prev, layoutItem]);
  }, []);

  const weatherLabel = useMemo(() => weatherLabelFromCode(weather.code), [weather.code]);
  const weatherTemp = useMemo(() => (weather.tempC == null ? "—" : `${Math.round(weather.tempC)}°C`), [weather.tempC]);

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ds-muted">Operations dashboard</p>
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
            {!isKiosk ? (
              <button
                type="button"
                className="ds-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
                onClick={openKiosk}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                Fullscreen
              </button>
            ) : null}
            {!hideHeaderWelcome ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-ds-border bg-ds-secondary/40 px-3 py-2 text-sm font-semibold text-ds-foreground">
                <span className="hidden sm:inline">Welcome,</span> {model.welcomeName}
              </span>
            ) : null}
          </div>
        </div>

        {model.bannerNote ? (
          <div className="border-t border-ds-border bg-ds-secondary/40 px-5 py-2.5 text-sm font-semibold text-ds-foreground">
            {model.bannerNote}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-ds-border bg-white p-5 shadow-[var(--ds-shadow-card)] dark:bg-ds-primary">
        {!readOnly ? (
          <div className="mb-5 flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-xl border border-ds-border bg-ds-secondary p-1 shadow-[var(--ds-shadow-card)] dark:bg-ds-secondary"
            role="group"
            aria-label="Dashboard layout"
          >
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Done editing layout" : "Edit dashboard layout"}
              aria-label={editMode ? "Done editing layout" : "Edit dashboard layout"}
              aria-pressed={editMode}
              className={[
                "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors",
                editMode
                  ? "bg-ds-success text-ds-on-accent shadow-sm"
                  : "text-ds-foreground hover:bg-ds-surface-elevated dark:hover:bg-white/10",
              ].join(" ")}
            >
              {editMode ? (
                <Check className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
              ) : (
                <Pencil className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
              )}
            </button>
            <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden />
            <button
              type="button"
              disabled={!editMode}
              onClick={() => editMode && setShowAddWidget(true)}
              title={
                editMode
                  ? "Add a built-in card or a custom page peek"
                  : "Turn on edit mode to add widgets"
              }
              aria-label="Add widget"
              className={[
                "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                editMode
                  ? "cursor-pointer text-ds-foreground hover:bg-ds-surface-elevated dark:hover:bg-white/10"
                  : "cursor-not-allowed text-ds-muted/50",
              ].join(" ")}
            >
              <Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
          </div>
        ) : null}

        <div ref={containerRef as any}>
          {mounted ? (
            editMode ? (
              <GridLayout
                layout={layout}
                width={width}
                gridConfig={{ cols: 12, rowHeight: 100, margin: [24, 24], containerPadding: [0, 0] }}
                dragConfig={{ enabled: !readOnly && editMode, bounded: false, handle: ".dashboard-drag-handle" }}
                resizeConfig={{ enabled: !readOnly && editMode, handles: ["se"] }}
                compactor={noCompactor}
                onLayoutChange={(next) => {
                  if (readOnly) return;
                  setLayout(next);
                }}
              >
                {layout.map((item) => {
            if (item.i.startsWith("cw_")) {
              const cfg = customConfigs[item.i];
              if (!cfg) return <div key={item.i} />;
              const headerRight = (
                <div className="flex items-center gap-2">
                  {!readOnly && editMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPeekWizardInitial(cfg);
                        setPeekWizardMode("edit");
                        setShowPeekWizard(true);
                      }}
                      className="inline-flex items-center rounded-md border border-black/10 bg-white/80 px-2 py-1 text-slate-700 hover:bg-white dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:hover:bg-ds-interactive-hover"
                      aria-label="Customize peek widget"
                      title="Customize"
                    >
                      <Settings className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                  {!readOnly && editMode ? (
                    <span className="dashboard-drag-handle select-none rounded-md border border-black/10 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-sm dark:bg-white/85 dark:text-slate-900">
                      Drag
                    </span>
                  ) : null}
                  {!readOnly && editMode ? (
                    <button
                      type="button"
                      onClick={() => removeWidget(item.i)}
                      className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                      aria-label={`Remove ${cfg.title}`}
                      title="Remove widget"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
              return (
                <div
                  key={item.i}
                  className={["transition-transform", editMode ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
                >
                  <WorkerDashCard title={cfg.title} headerRight={headerRight} className="h-full">
                    <DashboardCustomPeekWidget config={cfg} model={model} />
                  </WorkerDashCard>
                </div>
              );
            }
            const w = (widgetRegistry as Record<string, any>)[item.i] as
              | { title: string; accent: "yellow" | "red" | "blue" | "green" | "none"; render: () => ReactNode }
              | null
              | undefined;
            if (!w) return <div key={item.i} />;
            const alertsPeek =
              item.i === "alerts" ? (
                <Link href={pulseRoutes.monitoring} className="ds-link text-xs font-semibold">
                  View all
                </Link>
              ) : null;
            const headerRight = (
              <div className="flex items-center gap-2">
                {alertsPeek}
                {!readOnly && editMode ? (
                  <span className="dashboard-drag-handle select-none rounded-md border border-black/10 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-sm dark:bg-white/85 dark:text-slate-900">
                    Drag
                  </span>
                ) : null}
                {!readOnly && editMode ? (
                  <button
                    type="button"
                    onClick={() => removeWidget(item.i)}
                    className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                    aria-label={`Remove ${w.title}`}
                    title="Remove widget"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
            return (
              <div
                key={item.i}
                data-guided-tour-anchor={
                  item.i === "alerts"
                    ? "dashboard-alerts"
                    : item.i === "workforce"
                      ? "dashboard-workforce"
                      : item.i === "inventory"
                        ? "dashboard-inventory"
                        : undefined
                }
                className={[
                  "transition-transform",
                  editMode ? "cursor-grab active:cursor-grabbing" : "",
                ].join(" ")}
              >
                <WorkerDashCard title={w.title} headerRight={headerRight} className={["h-full", item.i === "setup" ? "overflow-auto" : ""].join(" ")}>
                  {w.render()}
                </WorkerDashCard>
              </div>
            );
                })}
              </GridLayout>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {layout.map((item) => {
                  if (item.i.startsWith("cw_")) {
                    const cfg = customConfigs[item.i];
                    if (!cfg) return null;
                    const headerRight = !readOnly ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPeekWizardInitial(cfg);
                            setPeekWizardMode("edit");
                            setShowPeekWizard(true);
                          }}
                          className="inline-flex items-center rounded-md border border-ds-border bg-ds-secondary/60 px-2 py-1 text-ds-foreground hover:bg-ds-interactive-hover"
                          aria-label="Customize peek widget"
                          title="Customize"
                        >
                          <Settings className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(item.i)}
                          className="rounded-md border border-ds-border bg-ds-secondary/60 px-2 py-1 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                          aria-label={`Remove ${cfg.title}`}
                          title="Remove widget"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                    return (
                      <WorkerDashCard key={item.i} title={cfg.title} headerRight={headerRight}>
                        <DashboardCustomPeekWidget config={cfg} model={model} />
                      </WorkerDashCard>
                    );
                  }
                  const w = (widgetRegistry as Record<string, any>)[item.i] as
                    | { title: string; render: () => ReactNode }
                    | null
                    | undefined;
                  if (!w) return null;
                  const headerRight =
                    item.i === "alerts" ? (
                      <Link href={pulseRoutes.monitoring} className="ds-link text-xs font-semibold">
                        View all
                      </Link>
                    ) : null;
                  return (
                    <WorkerDashCard
                      key={item.i}
                      title={w.title}
                      headerRight={headerRight}
                      className={item.i === "setup" ? "md:col-span-2 xl:col-span-3" : ""}
                    >
                      {w.render()}
                    </WorkerDashCard>
                  );
                })}
              </div>
            )
          ) : null}
        </div>

        {showAddWidget ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="ds-modal-backdrop absolute inset-0" onClick={() => setShowAddWidget(false)} aria-hidden />
            <div className="relative w-full max-w-md rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Add Widget</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Re-enable a built-in card, or build a compact &quot;peek&quot; from another Pulse page (pick slices and
                    options).
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowAddWidget(false)}
                  aria-label="Close add widget dialog"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-ds-border bg-ds-secondary px-4 py-3 text-left text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                  onClick={() => {
                    setShowAddWidget(false);
                    setPeekWizardInitial(null);
                    setPeekWizardMode("create");
                    setShowPeekWizard(true);
                  }}
                >
                  <span>Custom page peek…</span>
                  <span className="text-xs font-semibold text-[var(--ds-info)]">New</span>
                </button>
                <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Built-in cards</p>
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-slate-600">All built-in widgets are already on the board.</p>
                ) : (
                  availableToAdd.map((key) => {
                    const ww = (widgetRegistry as Record<string, any>)[key] as { title: string } | null | undefined;
                    if (!ww) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                        onClick={() => {
                          addWidget(key);
                          setShowAddWidget(false);
                        }}
                      >
                        <span>{ww.title}</span>
                        <span className="text-slate-500">Add</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!readOnly ? (
          <DashboardAddWidgetWizard
            open={showPeekWizard}
            mode={peekWizardMode}
            initialConfig={peekWizardInitial}
            onClose={() => {
              setShowPeekWizard(false);
              setPeekWizardInitial(null);
            }}
            onSave={saveCustomPeek}
          />
        ) : null}
      </div>
    </div>
  );
}

export type OperationalDashboardVariant = "demo" | "live";

export function OperationalDashboard({
  variant,
  onReady,
  readOnly = false,
  tokenOverride = null,
}: {
  variant: OperationalDashboardVariant;
  /** Fires once when the dashboard has finished its initial load (live fetch done or demo mounted). */
  onReady?: (payload?: OperationalDashboardReadyPayload) => void;
  /** Kiosk / read-only mode disables layout editing and widget add/remove. */
  readOnly?: boolean;
  /** Optional bearer token for kiosk links (`?token=`) when no session exists. */
  tokenOverride?: string | null;
}) {
  const { session } = usePulseAuth();
  const [liveModel, setLiveModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(variant === "live");
  const [error, setError] = useState<string | null>(null);
  const [zoneDismissed, setZoneDismissed] = useState(false);
  const readyNotifiedRef = useRef(false);
  const [showSetupChecklist, setShowSetupChecklist] = useState(false);

  const workOrdersHref =
    pulseTenantNav.find((n) => n.href === "/dashboard/maintenance")?.href ?? "/dashboard/maintenance";

  const notifyReady = useCallback(
    (payload?: OperationalDashboardReadyPayload) => {
      if (readyNotifiedRef.current) return;
      readyNotifiedRef.current = true;
      onReady?.(payload ?? { criticalCount: 0, warningCount: 0 });
    },
    [onReady],
  );

  const fetchJson = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (tokenOverride) {
        const res = await fetch(path, { headers: { Authorization: `Bearer ${tokenOverride}` }, cache: "no-store" });
        if (!res.ok) throw new Error(`http_${res.status}`);
        return (await res.json()) as T;
      }
      return await apiFetch<T>(path);
    },
    [tokenOverride],
  );

  const fetchLive = useCallback(async () => {
    const sess = readSession();
    if (!tokenOverride && !canAccessPulseTenantApis(sess)) {
      setLoading(false);
      setError(
        sess && (sess.is_system_admin === true || sess.role === "system_admin")
          ? "The operations dashboard is for tenant accounts. Sign in with a company user, or open System admin and use impersonation to view a tenant."
          : "Your account is not linked to an organization. Contact your administrator.",
      );
      setLiveModel(null);
      notifyReady();
      return;
    }

    let readyPayload: OperationalDashboardReadyPayload = { criticalCount: 0, warningCount: 0 };

    setLoading(true);
    setError(null);
    // Same local calendar day as `buildLiveModel` / schedule module (exclusive end = next local midnight).
    const { dayStartMs, dayEndMsExclusive } = localCalendarDayBoundsMs(getServerNow());
    const from = new Date(dayStartMs).toISOString();
    const to = new Date(dayEndMsExclusive).toISOString();

    try {
      const [dash, wrList, workers, assetList, lowStock, zoneList, beaconList, setupProgress] = await Promise.all([
        fetchJson<DashboardPayload>("/api/v1/pulse/dashboard"),
        fetchJson<WorkRequestListOut>("/api/v1/pulse/work-requests?limit=40&offset=0"),
        fetchJson<WorkerOut[]>("/api/v1/pulse/workers"),
        fetchJson<AssetOut[]>("/api/v1/pulse/assets"),
        fetchJson<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
        fetchJson<ZoneOut[]>("/api/v1/pulse/schedule-facilities"),
        fetchJson<BeaconEquipmentOut[]>("/api/v1/pulse/equipment"),
        fetchSetupProgress().catch(() => null),
      ]);
      let shiftList: ShiftOut[] = [];
      try {
        shiftList = await fetchJson<ShiftOut[]>(
          `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
      } catch (se) {
        const st = (se as { status?: number })?.status;
        if (st !== 403) throw se;
      }
      const auth = readSession();
      const model = buildLiveModel(
        dash,
        wrList,
        workers,
        shiftList,
        assetList,
        lowStock,
        zoneList,
        beaconList,
      );
      const welcome = welcomeFromSession(auth?.email, auth?.full_name);
      const withWelcome: DashboardViewModel = { ...model, welcomeName: welcome, bannerNote: null };
      readyPayload = alertCountsFromAlerts(withWelcome.alerts);
      setLiveModel(withWelcome);
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      if (e.status === 403) {
        setError(
          "You don’t have access to this dashboard with the current account. Tenant users see live data here; system admins should impersonate a company user from System admin.",
        );
      } else {
        setError("Could not load dashboard. Check that the API is running and you are signed in.");
      }
      setLiveModel(null);
    } finally {
      setLoading(false);
      notifyReady(readyPayload);
    }
    // Intentionally omit session from deps: usePulseAuth hydrates after mount and would re-run this eight-way
    // fetch. Welcome uses readSession() inside the try block above.
  }, [fetchJson, notifyReady, tokenOverride, variant]);

  useEffect(() => {
    if (variant !== "live" || !isApiMode()) return;
    void fetchLive();
  }, [variant, fetchLive]);

  useEffect(() => {
    if (variant === "demo") {
      notifyReady(alertCountsFromAlerts(demoModel().alerts));
    }
  }, [variant, notifyReady]);

  useEffect(() => {
    if (variant !== "live") {
      setShowSetupChecklist(false);
      return;
    }
    if (!isApiMode()) {
      setShowSetupChecklist(false);
      return;
    }
    if (!session || !canAccessPulseTenantApis(session) || !sessionHasAnyRole(session, "company_admin")) {
      setShowSetupChecklist(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const onb = await fetchOnboarding();
        if (cancelled) return;
        if (!onb.onboarding_enabled) {
          setShowSetupChecklist(false);
          return;
        }
        if (onb.onboarding_role !== "admin") {
          setShowSetupChecklist(false);
          return;
        }
        const orgDone = onb.org_onboarding_completed ?? onb.onboarding_completed;
        let bannerDismissed = true;
        try {
          bannerDismissed = localStorage.getItem(ADMIN_SETUP_BANNER_DISMISS_KEY) === "1";
        } catch {
          bannerDismissed = true;
        }
        const hasBanner = orgDone && !bannerDismissed;
        const hasSteps = Array.isArray(onb.steps) && onb.steps.length > 0;
        // Show if there is an active checklist OR the completion banner.
        setShowSetupChecklist((!orgDone && hasSteps) || hasBanner);
      } catch {
        // If onboarding can't load, prefer hiding the widget vs showing an empty card.
        if (!cancelled) setShowSetupChecklist(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, variant]);

  const facilitySetupSlot =
    variant === "live" && showSetupChecklist ? <AdminOnboardingChecklist /> : null;

  if (variant === "demo") {
    return (
      <DashboardBody
        model={demoModel()}
        workOrdersHref={workOrdersHref}
        facilitySetupChecklist={null}
        readOnly={readOnly}
      />
    );
  }

  if (loading) {
    return (
      <div className="app-dashboard-tile rounded-md p-12 text-center">
        <p className="text-sm text-ds-muted">Loading live dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-notification ds-notification-critical flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
          <p className="text-sm text-ds-foreground" role="status">
            {error}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchLive()}
          className="ds-btn-solid-primary shrink-0 px-4 py-2 text-sm sm:mt-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!liveModel) {
    return (
      <p className="text-sm text-ds-muted">No dashboard data available.</p>
    );
  }

  return (
    <DashboardBody
      model={liveModel}
      workOrdersHref={workOrdersHref}
      hideHeaderWelcome
      zonePromptDismissed={zoneDismissed}
      onDismissZonePrompt={() => setZoneDismissed(true)}
      headerLogoUrl="/images/panologo.png"
      headerCompanyName={session?.company?.name ?? null}
      facilitySetupChecklist={facilitySetupSlot}
      readOnly={readOnly}
    />
  );
}
