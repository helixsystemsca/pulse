"use client";

import { AlertCircle, AlertTriangle, Check, Cloud, Info, Monitor, Pencil, Plus, Radio, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GridLayout, useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout";
import { DashboardAddWidgetWizard } from "@/components/dashboard/DashboardAddWidgetWizard";
import { DashboardCustomPeekWidget } from "@/components/dashboard/DashboardCustomPeekWidget";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiFetch, isApiMode } from "@/lib/api";
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession, type PulseAuthSession } from "@/lib/pulse-session";
import { canAccessCompanyConfiguration, sessionHasAnyRole } from "@/lib/pulse-roles";
import { getServerDate, getServerNow } from "@/lib/serverTime";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { DASHBOARD_CUSTOM_WIDGETS_STORAGE, type CustomDashboardWidgetConfig } from "@/lib/dashboardPageWidgetCatalog";
import { fetchTrainingMatrix, mapApiAssignments, mapApiEmployees, mapApiPrograms } from "@/lib/trainingApi";
import { computeComplianceRadialSummary } from "@/lib/training/selectors";
import type { WorkerDayAttendanceMark } from "@/lib/dashboard/worker-day-attendance-store";
import { useWorkerDayAttendanceStore, workerDayAttendanceKey } from "@/lib/dashboard/worker-day-attendance-store";
import {
  localScheduleDateKey,
  mergedScheduleShiftsForCalendarDate,
  shiftIntervalBoundsMs,
} from "@/lib/schedule/dashboardScheduleDay";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { KioskRotateFooter } from "@/components/dashboard/DashboardChrome";
import { OpsWidgetShell } from "@/components/dashboard/widgets/ops/OpsWidgetShell";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";
import { UI } from "@/styles/ui";
import { getWidgetMode, type WidgetMode, type WidgetRenderContext } from "@/components/dashboard/widgets/widgetSizing";
import { TrainingComplianceWidget } from "@/components/dashboard/widgets/training/TrainingComplianceWidget";
import { ImportantDatesOpsWidget } from "@/components/dashboard/widgets/ops/ImportantDatesOpsWidget";
import { NotificationsWorkOrdersOpsWidget } from "@/components/dashboard/widgets/ops/NotificationsWorkOrdersOpsWidget";
import { LowInventoryOpsWidget } from "@/components/dashboard/widgets/ops/LowInventoryOpsWidget";
import { Co2MonitoringOpsWidget } from "@/components/dashboard/widgets/ops/Co2MonitoringOpsWidget";
import { PoolReadingsOpsWidget } from "@/components/dashboard/widgets/ops/PoolReadingsOpsWidget";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type AlertPriority = "critical" | "high" | "medium" | "low";

/** Fixed logical columns — 16-wide grid for 1x1/2x2 sizing and smaller base tiles. */
const DASHBOARD_GRID_COLS = 16;
/** Vertical pitch: half of prior (yields ~25% tile area at same w/h). */
const DASHBOARD_GRID_ROW_HEIGHT_PX = 36;
/** Horizontal + vertical gutter between cards (scaled down with the grid). */
const DASHBOARD_GRID_GAP_PX = 9;

function widgetPixelSizeFromGridUnits({
  gridWidthPx,
  cols,
  w,
  h,
  rowHeight,
  gap,
}: {
  gridWidthPx: number;
  cols: number;
  w: number;
  h: number;
  rowHeight: number;
  gap: number;
}) {
  const safeCols = Math.max(1, cols);
  const marginX = gap;
  const marginY = gap;
  const colWidth = (Math.max(0, gridWidthPx) - marginX * (safeCols - 1)) / safeCols;
  const widthPx = w * colWidth + (w - 1) * marginX;
  const heightPx = h * rowHeight + (h - 1) * marginY;
  return { widthPx: Math.max(0, widthPx), heightPx: Math.max(0, heightPx), colWidth: Math.max(0, colWidth) };
}

function layoutItemsCollide(a: LayoutItem, b: LayoutItem): boolean {
  if (a.i === b.i) return false;
  const ax = a.x ?? 0;
  const ay = a.y ?? 0;
  const aw = a.w ?? 1;
  const ah = a.h ?? 1;
  const bx = b.x ?? 0;
  const by = b.y ?? 0;
  const bw = b.w ?? 1;
  const bh = b.h ?? 1;
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Legacy 12-col layouts saved to localStorage become overlapping when `cols` is 8 (correctBounds forces
 * multiple full-width tiles to x=0). Clamp geometry and push colliding rows down so the grid is valid.
 */
function sanitizeLayoutForGrid(layout: Layout, cols: number): Layout {
  const ids = layout.map((l) => l.i);
  const clamped = layout.map((item) => {
    const minW = Math.max(1, Math.min(Number(item.minW ?? 1), cols));
    let w = Math.max(minW, Math.min(Number(item.w ?? 1), cols));
    let x = Number(item.x ?? 0);
    x = Math.max(0, Math.min(x, cols - w));
    if (x + w > cols) x = Math.max(0, cols - w);
    const minH = Math.max(1, Number(item.minH ?? 1));
    const h = Math.max(minH, Number(item.h ?? 1));
    return {
      ...item,
      x,
      w,
      h,
      minW: Math.min(minW, cols) as number,
    };
  });
  const sorted = [...clamped].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  const placed: LayoutItem[] = [];
  for (const raw of sorted) {
    let y = Number(raw.y ?? 0);
    let guard = 0;
    while (guard < 500 && placed.some((p) => layoutItemsCollide({ ...raw, y }, p))) {
      y++;
      guard++;
    }
    placed.push({ ...raw, y });
  }
  const byId = new Map(placed.map((p) => [p.i, p]));
  return ids.map((i) => byId.get(i)).filter((x): x is LayoutItem => x != null);
}

/** Operations dashboard header: icon tools get a teal hover inside the unified actions card. */
const OPS_DASH_HEADER_TOOL =
  "h-10 w-10 min-h-0 rounded-lg !border-2 !border-ds-border bg-transparent !px-0 !py-0 text-ds-foreground shadow-none ring-0 transition-colors hover:!border-[var(--ds-accent)] hover:!bg-[color-mix(in_srgb,var(--ds-accent)_14%,var(--ds-bg))] hover:!text-[var(--ds-accent)] focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-[var(--ds-accent)] dark:hover:!bg-[color-mix(in_srgb,var(--ds-accent)_20%,transparent)]";
const OPS_DASH_HEADER_TOOL_ACTIVE =
  "h-10 w-10 min-h-0 rounded-lg !border-0 !bg-[var(--ds-accent)] !px-0 !py-0 !text-white shadow-none ring-0 transition-colors hover:!border-0 hover:!bg-[color-mix(in_srgb,var(--ds-accent)_88%,#0f172a)] hover:!text-white focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-white/80";

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

function kioskWorkQueueRows(model: DashboardViewModel): {
  key: string;
  title: string;
  status: string;
  tone: "critical" | "warn" | "ok";
}[] {
  const out: { key: string; title: string; status: string; tone: "critical" | "warn" | "ok" }[] = [];
  for (const c of model.workRequests.critical.slice(0, 5)) {
    out.push({ key: `cr-${out.length}`, title: c.title, status: "Critical", tone: "critical" });
  }
  if (model.workRequests.newest) {
    const k = model.workRequests.newest.tag.kind;
    out.push({
      key: "new",
      title: model.workRequests.newest.title,
      status: model.workRequests.newest.tag.label.slice(0, 16),
      tone: k === "overdue" || k === "urgent" ? "critical" : k === "progress" ? "warn" : "ok",
    });
  }
  if (model.workRequests.oldest) {
    out.push({
      key: "old",
      title: model.workRequests.oldest.title,
      status: "In queue",
      tone: "ok",
    });
  }
  return out.slice(0, 8);
}

const NO_ACTIVE_ALERTS_TITLE = "No active alerts";

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
  /** Sick / DNS mark from schedule UI (local) until attendance telemetry. */
  attendanceMark?: WorkerDayAttendanceMark;
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
    /**
     * Anyone with a shift on the calendar today (same source as schedule), ordered for dashboard display:
     * on site, on shift now, upcoming, other scheduled, then off site.
     */
    scheduledTodayRoster: WorkforceBubble[];
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
  training: {
    totalSlots: number;
    completed: number;
    expiringSoon: number;
    missing: number;
    overallCompliancePercent: number;
  };
  /** Hero KPI strip — prefer these over placeholder constants so tiles match lists below. */
  stripCounts: {
    activeRequests: number;
    overdue: number;
    lowStock: number;
    outOfService: number;
    onSite: number;
    completedToday: number;
  };
};

function mergeAttendanceMarksIntoBubbles(
  bubbles: WorkforceBubble[],
  marks: Record<string, WorkerDayAttendanceMark>,
  dateKey: string,
): WorkforceBubble[] {
  return bubbles.map((b) => ({
    ...b,
    attendanceMark: marks[workerDayAttendanceKey(b.id, dateKey)],
  }));
}

function mergeAttendanceIntoDashboardModel(
  model: DashboardViewModel,
  marks: Record<string, WorkerDayAttendanceMark>,
): DashboardViewModel {
  const dateKey = localScheduleDateKey(getServerNow());
  return {
    ...model,
    workforce: {
      ...model.workforce,
      onSite: mergeAttendanceMarksIntoBubbles(model.workforce.onSite, marks, dateKey),
      onShiftNow: mergeAttendanceMarksIntoBubbles(model.workforce.onShiftNow, marks, dateKey),
      upcomingToday: mergeAttendanceMarksIntoBubbles(model.workforce.upcomingToday, marks, dateKey),
      onScheduleToday: mergeAttendanceMarksIntoBubbles(model.workforce.onScheduleToday, marks, dateKey),
      offSite: mergeAttendanceMarksIntoBubbles(model.workforce.offSite, marks, dateKey),
      scheduledTodayRoster: mergeAttendanceMarksIntoBubbles(model.workforce.scheduledTodayRoster, marks, dateKey),
    },
  };
}

const roleBadgeBase =
  "pointer-events-none absolute -top-0.5 -right-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold leading-none text-ds-on-accent shadow-[var(--ds-shadow-card)] ring-2 ring-[var(--ds-surface-primary)]";

/** Dashboard workforce bubbles: neutral glassy fill; photo replaces initials when `avatar_url` resolves. */
const workforceAvatarGoldBase =
  "rounded-full bg-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] backdrop-blur-md font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-text-primary)_18%,transparent)] ring-offset-2 ring-offset-[var(--ds-surface-primary)]";

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

/** Order for the operations workforce widget: physical presence first, then shift window, then the rest. */
function rosterDisplayOrder(b: WorkforceBubble): number {
  if (b.presence.status === "on_site") return 0;
  if (b.scheduleBucket === "on_shift_now") return 1;
  if (b.scheduleBucket === "upcoming_today") return 2;
  if (b.scheduleBucket === null) return 3;
  if (b.scheduleBucket === "off_site") return 4;
  return 5;
}

function sortScheduledTodayRoster(a: WorkforceBubble, b: WorkforceBubble): number {
  const d = rosterDisplayOrder(a) - rosterDisplayOrder(b);
  if (d !== 0) return d;
  return sortWorkforceByRoleThenName(a, b);
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
      ? "bg-emerald-500 dark:bg-emerald-400"
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

function WorkforceAttendanceBadge({ mark }: { mark: WorkerDayAttendanceMark }) {
  const label = mark === "dns" ? "DNS" : "Sick";
  return (
    <span
      className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-[42%] whitespace-nowrap rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide text-white shadow-sm ring-2 ring-[var(--ds-surface-primary)] bg-[#e8706f]"
      aria-label={label}
    >
      {label}
    </span>
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

function workforceStatusLineFromTitle(title: string): string | null {
  const i = title.indexOf(" · ");
  if (i === -1) return null;
  return title.slice(i + 3).trim() || null;
}

function WorkforceBubbleStack({
  bubble,
  faceClassName,
  badges,
  statusLine = false,
}: {
  bubble: WorkforceBubble;
  faceClassName: string;
  badges?: ReactNode;
  /** When true, show the schedule status from `title` (after ·) under the name */
  statusLine?: boolean;
}) {
  const resolvedSrc = useResolvedAvatarSrc(bubble.avatar_url ?? null);
  const showNameWithPhoto = Boolean(resolvedSrc && bubble.displayName.trim());
  const showNameLabel = statusLine ? Boolean(bubble.displayName.trim()) : showNameWithPhoto;
  const status = statusLine ? workforceStatusLineFromTitle(bubble.title) : null;

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span title={bubble.title} className={faceClassName}>
        <WorkforceBubbleFaceContent
          initials={bubble.initials}
          resolvedSrc={resolvedSrc}
          photoAlt={bubble.displayName}
        />
        {badges}
      </span>
      {showNameLabel ? (
        <span className="max-w-[6.5rem] truncate text-center text-[10px] font-semibold leading-tight text-black dark:text-white">
          {bubble.displayName}
        </span>
      ) : null}
      {status ? (
        <span className="max-w-[7rem] text-center text-[9px] leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
          {status}
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
  if (fullName?.trim()) {
    const first = (fullName.trim().split(/\s+/)[0] ?? "").replace(/[.,:;!?$]+$/, "");
    if (first) return first;
  }
  if (email) {
    const local = (email.split("@")[0] ?? "").trim();
    if (local) return local;
  }
  return "";
}

function demoModel(): DashboardViewModel {
  const demoWorkforceOnSite: WorkforceBubble[] = [
    {
      id: "0",
      initials: "TC",
      displayName: "Taylor Cruz",
      title: "Taylor Cruz · On site",
      presence: { status: "on_site", lastSeen: Date.now() - 1000 * 60 * 2, lastZone: "Zone 1" },
      lastEvent: { type: "enter", timestamp: Date.now() - 1000 * 60 * 12 },
      scheduleBucket: "on_site",
      badge: "M",
      roleSortRank: 0,
    },
  ];
  const demoWorkforceOnShift: WorkforceBubble[] = [
    {
      id: "2",
      initials: "AR",
      displayName: "Avery Rowe",
      title: "Avery Rowe · On shift now",
      presence: { status: "unknown", lastSeen: null, lastZone: null },
      lastEvent: null,
      scheduleBucket: "on_shift_now",
      badge: "S",
      roleSortRank: 1,
    },
  ];
  const demoWorkforceUpcoming: WorkforceBubble[] = [
    {
      id: "1",
      initials: "MR",
      displayName: "Morgan Reid",
      title: "Morgan Reid · Upcoming today",
      presence: { status: "unknown", lastSeen: null, lastZone: null },
      lastEvent: null,
      scheduleBucket: "upcoming_today",
      badge: "L",
      roleSortRank: 2,
    },
  ];
  const demoWorkforceOffSite: WorkforceBubble[] = [
    {
      id: "7",
      initials: "RW",
      displayName: "River Walsh",
      title: "River Walsh · Off site",
      presence: { status: "unknown", lastSeen: null, lastZone: null },
      lastEvent: { type: "exit", timestamp: Date.now() - 1000 * 60 * 35 },
      scheduleBucket: "off_site",
      roleSortRank: 3,
    },
  ];
  const demoScheduledTodayRoster = [
    ...demoWorkforceOnSite,
    ...demoWorkforceOnShift,
    ...demoWorkforceUpcoming,
    ...demoWorkforceOffSite,
  ].sort(sortScheduledTodayRoster);

  return {
    title: "Operations Dashboard",
    welcomeName: "",
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
      onSite: demoWorkforceOnSite,
      onShiftNow: demoWorkforceOnShift,
      upcomingToday: demoWorkforceUpcoming,
      onScheduleToday: [],
      offSite: demoWorkforceOffSite,
      scheduledTodayRoster: demoScheduledTodayRoster,
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
    training: {
      totalSlots: 120,
      completed: 92,
      expiringSoon: 14,
      missing: 14,
      overallCompliancePercent: 88,
    },
    stripCounts: {
      activeRequests: 7,
      overdue: 2,
      lowStock: 3,
      outOfService: 1,
      onSite: 1,
      completedToday: 12,
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
  trainingMatrix: Awaited<ReturnType<typeof fetchTrainingMatrix>> | null,
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

  const bubbles: WorkforceBubble[] = [...scheduledIdsOnCalendar].map((wid) => {
    const w = workerById.get(wid);
    const initials = w ? initialsFromUser(w.email, w.full_name) : "?";
    const mineRows = dayMerged.filter((s) => s.workerId === wid);
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

    const presence: WorkforceBubble["presence"] = w
      ? {
          status: w.presence?.status ?? "unknown",
          lastSeen: parseTs(w.presence?.lastSeen),
          lastZone: w.presence?.lastZone ?? null,
        }
      : { status: "unknown", lastSeen: null, lastZone: null };

    const lastEvent: WorkforceBubble["lastEvent"] =
      w && w.lastEvent?.type && (w.lastEvent.type === "enter" || w.lastEvent.type === "exit")
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
    const titleBase = w ? `${w.full_name ?? w.email}` : "Assignee not in roster";
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

    const { badge, rank: roleSortRank } = workforceRoleBadgeAndRank(w?.role ?? "worker");
    const displayName = w ? w.full_name?.trim() || w.email.split("@")[0] || w.email : "Unknown assignee";
    return {
      id: wid,
      initials,
      displayName,
      title,
      presence,
      lastEvent,
      scheduleBucket,
      badge,
      roleSortRank,
      avatar_url: w?.avatar_url,
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

  const scheduledTodayRoster = [...bubbles].sort(sortScheduledTodayRoster);

  const openItems = wr.items.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const overdueOpenCount = openItems.filter((i) => {
    if (!i.due_date) return false;
    return new Date(i.due_date).getTime() < now;
  }).length;
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

  const training = (() => {
    if (!trainingMatrix) {
      return { totalSlots: 0, completed: 0, expiringSoon: 0, missing: 0, overallCompliancePercent: 0 };
    }
    const programs = mapApiPrograms(trainingMatrix.programs);
    const employees = mapApiEmployees(trainingMatrix.employees);
    const assignments = mapApiAssignments(trainingMatrix.assignments);
    const sum = computeComplianceRadialSummary(employees, programs, assignments, [], { trustAssignmentStatus: true });
    return {
      totalSlots: sum.totalSlots,
      completed: sum.completed,
      expiringSoon: sum.expiringSoon,
      missing: sum.missing,
      overallCompliancePercent: sum.overallCompliancePercent,
    };
  })();

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
      scheduledTodayRoster,
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
    training,
    stripCounts: {
      activeRequests: dashboard.open_work_requests,
      overdue: overdueOpenCount,
      lowStock: dashboard.low_stock_items,
      outOfService: oos.length,
      onSite: onSite.length,
      completedToday: 0,
    },
  };
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

function OperationsHeaderLogoMark({
  logoUrl,
  companyName,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
}) {
  const raw = logoUrl?.trim() || null;
  const isExternal = Boolean(raw && (raw.startsWith("http://") || raw.startsWith("https://")));
  // Public Next.js assets (e.g. `/images/panoramalogo.png`) should NOT be fetched with bearer auth.
  const isPublicLocal = Boolean(raw && raw.startsWith("/") && !raw.startsWith("/api"));
  const internal = raw && !isExternal && !isPublicLocal ? raw : null;
  const resolved = useAuthenticatedAssetSrc(internal);
  const src = !raw ? null : isExternal || isPublicLocal ? raw : resolved;
  const waiting = Boolean(internal && !src);
  const initials = headerInitials(companyName ?? "");

  return (
    <div
      className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden border-2 border-gray-200 bg-gray-50"
      title={(companyName?.trim() || "Company").slice(0, 48)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob or tenant https URL
        <img src={src} alt="" className="h-full w-full object-contain p-1.5" />
      ) : waiting ? (
        <span className="h-8 w-8 animate-pulse bg-gray-200" aria-hidden />
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
  session,
  dashboardContext,
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
  session: PulseAuthSession | null | undefined;
  dashboardContext: "operations" | "admin";
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
  const canEditLayout = useMemo(() => {
    if (readOnly || isKiosk) return false;
    return canAccessCompanyConfiguration(session);
  }, [isKiosk, readOnly, session]);

  const layoutStorageKey = useMemo(() => {
    const mode = isKiosk ? "kiosk" : "standard";
    /** v7: facility-style ops widgets + neutral canvas tokens. */
    return `pulse_dashboard_layout_v7_${dashboardContext}_${mode}`;
  }, [dashboardContext, isKiosk]);

  const customWidgetStorageKey = useMemo(() => {
    const mode = isKiosk ? "kiosk" : "standard";
    return `pulse_dashboard_widgets_v3_${dashboardContext}_${mode}`;
  }, [dashboardContext, isKiosk]);

  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (readOnly) setEditMode(false);
  }, [readOnly]);
  useEffect(() => {
    if (!canEditLayout) setEditMode(false);
  }, [canEditLayout]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showPeekWizard, setShowPeekWizard] = useState(false);
  const [peekWizardMode, setPeekWizardMode] = useState<"create" | "edit">("create");
  const [peekWizardInitial, setPeekWizardInitial] = useState<CustomDashboardWidgetConfig | null>(null);
  const [customConfigs, setCustomConfigs] = useState<Record<string, CustomDashboardWidgetConfig>>({});
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const kioskAlerts = useMemo(() => {
    const real = model.alerts
      .filter((a) => a.countsTowardTotals !== false)
      .filter((a) => a.title !== NO_ACTIVE_ALERTS_TITLE)
      .slice()
      .sort(compareAlerts)
      .slice(0, 3);
    if (real.length === 0) return model.alerts.slice(0, 3);
    return real;
  }, [model.alerts]);

  const kioskKpis = useMemo(() => {
    const k = model.stripCounts;
    return [
      { label: "Active requests", value: k.activeRequests },
      { label: "Overdue", value: k.overdue },
      { label: "Low stock", value: k.lowStock },
      { label: "Out of service", value: k.outOfService },
      { label: "On site", value: k.onSite },
      { label: "Completed today", value: k.completedToday },
    ] as const;
  }, [model.stripCounts]);

  const views = useMemo(() => ["overview", "workforce", "systems"] as const, []);
  const [viewIndex, setViewIndex] = useState(0);
  useEffect(() => {
    if (!isKiosk) return;
    const interval = window.setInterval(() => {
      setViewIndex((prev) => (prev + 1) % views.length);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isKiosk, views.length]);
  const currentView = views[viewIndex] ?? "overview";

  function KioskTile({ label, value }: { label: string; value: number }) {
    return (
      <div
        className={cn(
          DASH.kpiTile,
          "p-2 py-2 shadow-sm motion-safe:hover:translate-y-0 motion-safe:hover:shadow-[var(--dash-shadow-card-soft)] sm:p-2.5",
        )}
      >
        <p className={cn(DASH.kpiLabel, "text-[10px]")}>{label}</p>
        <p className={cn(DASH.kpiValue, "mt-1 text-lg sm:text-xl")}>{value}</p>
      </div>
    );
  }

  function KioskPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
      <OpsWidgetShell title={title} className="h-full min-h-0">
        <div className="flex min-h-0 h-full min-w-0 flex-col">{children}</div>
      </OpsWidgetShell>
    );
  }

  function KioskAlertCard({ alert }: { alert: AlertItem }) {
    const p = alertPriority(alert);
    const icon =
      p === "critical" ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-ds-danger sm:h-5 sm:w-5" aria-hidden />
      ) : p === "high" ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-ds-warning sm:h-5 sm:w-5" aria-hidden />
      ) : p === "medium" ? (
        <Info className="h-4 w-4 shrink-0 text-[var(--ds-info)] sm:h-5 sm:w-5" aria-hidden />
      ) : (
        <Radio className="h-4 w-4 shrink-0 text-ds-muted sm:h-5 sm:w-5" aria-hidden />
      );
    const strip =
      p === "critical"
        ? "bg-ds-danger"
        : p === "high"
          ? "bg-ds-warning"
          : p === "medium"
            ? "bg-[var(--ds-info)]"
            : "bg-ds-border";
    const shell =
      p === "critical"
        ? "border-ds-danger/30 bg-[color-mix(in_srgb,var(--ds-danger)_10%,var(--ds-primary))]"
        : p === "high"
          ? "border-ds-warning/35 bg-[color-mix(in_srgb,var(--ds-warning)_12%,var(--ds-primary))]"
          : p === "medium"
            ? "border-[color-mix(in_srgb,var(--ds-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-info)_10%,var(--ds-primary))]"
            : "border-ds-border bg-ds-secondary/40";

    return (
      <div className={cn("overflow-hidden rounded-xl border shadow-[var(--ds-shadow-card)]", shell)}>
        <div className={cn("h-[3px] w-full shrink-0", strip)} aria-hidden />
        <div className="flex gap-2 p-2">
          {icon}
          <div className="min-w-0">
            <p className="text-xs font-bold text-ds-foreground max-w-md truncate sm:text-sm">{alert.title}</p>
            {alert.subtitle ? (
              <p className="mt-0.5 text-[11px] leading-snug text-ds-muted max-w-md line-clamp-2 whitespace-pre-line sm:text-xs">
                {alert.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function OverviewView({ rowClass }: { rowClass: string }) {
    return (
      <>
        <div className={rowClass}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {kioskKpis.map((k) => (
              <KioskTile key={k.label} label={k.label} value={k.value} />
            ))}
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-2 md:grid-cols-3`}>
          {kioskAlerts.slice(0, 3).map((a, idx) => (
            <KioskAlertCard key={`${a.title}-${idx}`} alert={a} />
          ))}
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-2 md:grid-cols-3`}>
          <div className="col-span-1 min-h-0 min-w-0">
            <KioskPanel title="Workforce">
              <div className="min-h-0 min-w-0 w-full">
                {(widgetRegistry as Record<string, { render: () => ReactNode }>).workforce.render()}
              </div>
            </KioskPanel>
          </div>
          <div className="col-span-1 min-h-0 min-w-0">
            <KioskPanel title="Low inventory">
              <div className="min-h-0 min-w-0 w-full">
                {(widgetRegistry as Record<string, { render: () => ReactNode }>).low_inventory.render()}
              </div>
            </KioskPanel>
          </div>
          <div className="col-span-1 min-h-0 min-w-0">
            <KioskPanel title="Pool readings">
              <div className="min-h-0 min-w-0 w-full">
                {(widgetRegistry as Record<string, { render: () => ReactNode }>).pool_readings.render()}
              </div>
            </KioskPanel>
          </div>
        </div>
      </>
    );
  }

  function WorkforceView({ rowClass }: { rowClass: string }) {
    const onSite = model.workforce.onSite.slice(0, 12);
    return (
      <>
        <div className={rowClass}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KioskTile label="On site" value={model.stripCounts.onSite} />
            <KioskTile label="Active requests" value={model.stripCounts.activeRequests} />
            <KioskTile label="Awaiting assignment" value={model.workRequests.awaitingCount} />
            <KioskTile label="Overdue" value={model.stripCounts.overdue} />
            <KioskTile label="Completed today" value={model.stripCounts.completedToday} />
            <KioskTile label="Shifts today" value={Math.max(0, Number(model.workforce.summaryLine.match(/\d+/)?.[0] ?? 0))} />
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-2 lg:grid-cols-3`}>
          <div className="min-h-0 min-w-0 lg:col-span-2">
            <KioskPanel title="On-site workers">
              <div className="min-h-0 min-w-0 w-full">
                <div className="flex flex-wrap gap-2">
                  {onSite.length === 0 ? (
                    <p className="text-sm text-ds-muted">No workers currently on site.</p>
                  ) : (
                    onSite.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        faceClassName={onsiteAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            {b.attendanceMark ? <WorkforceAttendanceBadge mark={b.attendanceMark} /> : null}
                            <WorkforceStatusDot color="green" />
                          </>
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </KioskPanel>
          </div>

          <div className="min-h-0 min-w-0 lg:col-span-1">
            <KioskPanel title="Work focus">
              <div className="min-h-0 min-w-0 w-full space-y-2">
                <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Assigned vs unassigned</p>
                  <p className="mt-1.5 text-xs font-semibold text-ds-foreground sm:text-sm">
                    Unassigned: <span className="tabular-nums">{model.workRequests.awaitingCount}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-ds-foreground sm:text-sm">
                    Active: <span className="tabular-nums">{model.stripCounts.activeRequests}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Today</p>
                  <p className="mt-1.5 text-xs font-semibold text-ds-foreground sm:text-sm">
                    Completed: <span className="tabular-nums">{model.stripCounts.completedToday}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-ds-foreground sm:text-sm">
                    Overdue: <span className="tabular-nums">{model.stripCounts.overdue}</span>
                  </p>
                </div>
              </div>
            </KioskPanel>
          </div>
        </div>
      </>
    );
  }

  function SystemsView({ rowClass }: { rowClass: string }) {
    return (
      <>
        <div className={rowClass}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KioskTile label="Low stock" value={model.stripCounts.lowStock} />
            <KioskTile label="Out of service" value={model.stripCounts.outOfService} />
            <KioskTile label="Missing tools" value={model.equipment.missingCount} />
            <KioskTile label="Active tools" value={model.equipment.activeCount} />
            <KioskTile label="Inventory items" value={model.inventory.shoppingList.length} />
            <KioskTile label="Overdue" value={model.stripCounts.overdue} />
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-2 md:grid-cols-3`}>
          <div className="min-h-0 min-w-0">
            <KioskPanel title="Low inventory">
              <div className="min-h-0 min-w-0 w-full">{(widgetRegistry as Record<string, { render: () => ReactNode }>).low_inventory.render()}</div>
            </KioskPanel>
          </div>
          <div className="min-h-0 min-w-0">
            <KioskPanel title="CO₂ monitoring">
              <div className="min-h-0 min-w-0 w-full overflow-x-auto">
                {(widgetRegistry as Record<string, { render: () => ReactNode }>).co2_monitoring.render()}
              </div>
            </KioskPanel>
          </div>
          <div className="min-h-0 min-w-0">
            <KioskPanel title="Notifications & work orders">
              <div className="min-h-0 min-w-0 w-full">
                {(widgetRegistry as Record<string, { render: () => ReactNode }>).notifications_work_orders.render()}
              </div>
            </KioskPanel>
          </div>
        </div>
      </>
    );
  }

  const widgetRegistry = useMemo(() => {
    const workforceCardShell =
      "flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]";

    return {
      important_dates: {
        title: "Important dates",
        accent: "none" as const,
        render: () => <ImportantDatesOpsWidget />,
      },
      notifications_work_orders: {
        title: "Notifications & work orders",
        accent: "none" as const,
        render: () => <NotificationsWorkOrdersOpsWidget model={model} workOrdersHref={workOrdersHref} />,
      },
      training_compliance: {
        title: "Training compliance",
        accent: "none" as const,
        render: (ctx?: WidgetRenderContext) => (
          <TrainingComplianceWidget
            training={model.training}
            variant="dashboard"
            layoutContext={ctx ?? null}
            opsEmbedded
          />
        ),
      },
      workforce: {
        title: "Workforce",
        accent: "none" as const,
        render: () => (
          <div className={cn(workforceCardShell, "min-h-0 overflow-auto")}>
            <div>
              <p className="text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
                Today – {model.workforce.dateLabel}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                {model.workforce.summaryLine}
              </p>
            </div>
            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ds-accent)]">Scheduled today</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-2">
                  {model.workforce.scheduledTodayRoster.length === 0 ? (
                    <p className="text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                      No shifts on the roster for today.
                    </p>
                  ) : (
                    model.workforce.scheduledTodayRoster.map((b) => (
                      <WorkforceBubbleStack
                        key={b.id}
                        bubble={b}
                        statusLine
                        faceClassName={scheduledAvatarClass()}
                        badges={
                          <>
                            {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                            {b.attendanceMark ? <WorkforceAttendanceBadge mark={b.attendanceMark} /> : null}
                            <WorkforceStatusDot
                              color={
                                b.scheduleBucket === "on_shift_now" || b.presence.status === "on_site"
                                  ? "green"
                                  : b.scheduleBucket === "upcoming_today"
                                    ? "yellow"
                                    : "gray"
                              }
                            />
                          </>
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ),
      },
      low_inventory: {
        title: "Low inventory",
        accent: "none" as const,
        render: () => <LowInventoryOpsWidget model={model} />,
      },
      co2_monitoring: {
        title: "CO₂ monitoring",
        accent: "none" as const,
        render: () => <Co2MonitoringOpsWidget />,
      },
      pool_readings: {
        title: "Pool readings",
        accent: "none" as const,
        render: () => <PoolReadingsOpsWidget />,
      },
    } as const;
  }, [model, workOrdersHref]);

  const allWidgetKeys = useMemo(() => {
    return Object.keys(widgetRegistry).filter((k) => (widgetRegistry as Record<string, unknown>)[k] != null);
  }, [widgetRegistry]);

  const defaultLayout = useMemo(
    (): Layout => [
      { i: "important_dates", x: 0, y: 0, w: 5, h: 12, minW: 3, minH: 6 },
      { i: "notifications_work_orders", x: 5, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
      { i: "training_compliance", x: 11, y: 0, w: 5, h: 12, minW: 3, minH: 8 },
      { i: "workforce", x: 0, y: 12, w: 6, h: 10, minW: 4, minH: 6 },
      { i: "low_inventory", x: 6, y: 12, w: 5, h: 10, minW: 3, minH: 6 },
      { i: "co2_monitoring", x: 11, y: 12, w: 5, h: 7, minW: 3, minH: 5 },
      { i: "pool_readings", x: 0, y: 22, w: 16, h: 10, minW: 6, minH: 6 },
    ],
    [],
  );

  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [isInteracting, setIsInteracting] = useState(false);
  const isInteractingRef = useRef(false);
  useEffect(() => {
    isInteractingRef.current = isInteracting;
  }, [isInteracting]);

  // Load saved layout (v2) and custom peek configs; migrate legacy v1 layout once.
  useEffect(() => {
    let parsedConfigs: Record<string, CustomDashboardWidgetConfig> = {};
    try {
      const cw = window.localStorage.getItem(customWidgetStorageKey) ?? window.localStorage.getItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE);
      if (cw) parsedConfigs = JSON.parse(cw) as Record<string, CustomDashboardWidgetConfig>;
    } catch {
      parsedConfigs = {};
    }

    let nextLayout: Layout | null = null;
    let loadedFromStorage = false;
    try {
      const v3 = window.localStorage.getItem(layoutStorageKey);
      if (v3) {
        nextLayout = JSON.parse(v3) as Layout;
        loadedFromStorage = Array.isArray(nextLayout);
      }
    } catch {
      nextLayout = null;
    }
    // Do not load pre-v5 12-column layouts into the 8-col grid (they overlap after bounds correction).
    if (!loadedFromStorage || !nextLayout) nextLayout = defaultLayout;

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
    // Only merge in default widgets when there was no saved layout (first visit / cleared storage).
    // If we always merged missing defaults, removed widgets would reappear on every load / deploy.
    const present = new Set(filtered.map((x) => x.i));
    const missing = defaultLayout.filter((l) => !present.has(l.i));
    const merged = sanitizeLayoutForGrid(
      (loadedFromStorage ? filtered : [...filtered, ...missing]) as Layout,
      DASHBOARD_GRID_COLS,
    );
    setLayout(merged);
    setCustomConfigs(parsedConfigs);
    setLayoutHydrated(true);
  }, [allWidgetKeys, customWidgetStorageKey, dashboardContext, defaultLayout, isKiosk, layoutStorageKey]);

  const persistLayout = useCallback(
    (next: Layout) => {
      if (!layoutHydrated) return;
      try {
        window.localStorage.setItem(layoutStorageKey, JSON.stringify(next));
      } catch {
        /* ignore quota / privacy mode */
      }
    },
    [layoutHydrated, layoutStorageKey],
  );

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      window.localStorage.setItem(customWidgetStorageKey, JSON.stringify(customConfigs));
    } catch {
      /* ignore */
    }
  }, [customConfigs, customWidgetStorageKey, layoutHydrated]);

  const layoutKeys = useMemo(() => new Set(layout.map((l) => l.i)), [layout]);
  const availableToAdd = useMemo(() => allWidgetKeys.filter((k) => !layoutKeys.has(k)), [allWidgetKeys, layoutKeys]);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => {
      const next = prev.filter((l) => l.i !== id);
      persistLayout(next);
      return next;
    });
    if (id.startsWith("cw_")) {
      setCustomConfigs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [persistLayout]);

  const addWidget = useCallback(
    (id: string) => {
      if (layoutKeys.has(id)) return;
      const base = defaultLayout.find((l) => l.i === id);
      const next: LayoutItem = base ?? { i: id, x: 0, y: Infinity, w: 4, h: 2 };
      setLayout((prev) => {
        const merged = [...prev, { ...next, x: 0, y: Infinity }] as Layout;
        persistLayout(merged);
        return merged;
      });
    },
    [defaultLayout, layoutKeys, persistLayout],
  );

  const saveCustomPeek = useCallback((config: CustomDashboardWidgetConfig, layoutItem: LayoutItem | null) => {
    setCustomConfigs((prev) => ({ ...prev, [config.id]: config }));
    if (layoutItem) {
      setLayout((prev) => {
        const next = [...prev, layoutItem] as Layout;
        persistLayout(next);
        return next;
      });
    }
  }, [persistLayout]);

  const dragCompactor = useMemo(
    () => ({
      type: null,
      allowOverlap: true,
      compact: (l: Layout) => l,
    }),
    [],
  );
  const stableCompactor = useMemo(() => verticalCompactor, []);
  const activeCompactor = isInteracting ? dragCompactor : stableCompactor;

  const buildWidgetContext = useCallback(
    (item: LayoutItem): WidgetRenderContext => {
      const { widthPx, heightPx } = widgetPixelSizeFromGridUnits({
        gridWidthPx: width,
        cols: DASHBOARD_GRID_COLS,
        w: item.w ?? 1,
        h: item.h ?? 1,
        rowHeight: DASHBOARD_GRID_ROW_HEIGHT_PX,
        gap: DASHBOARD_GRID_GAP_PX,
      });
      const mode: WidgetMode = getWidgetMode({
        gridW: item.w ?? 1,
        gridH: item.h ?? 1,
        widthPx,
        heightPx,
      });
      return { mode, gridW: item.w ?? 1, gridH: item.h ?? 1, widthPx, heightPx };
    },
    [width],
  );

  const weatherLabel = useMemo(() => weatherLabelFromCode(weather.code), [weather.code]);
  const weatherTemp = useMemo(() => (weather.tempC == null ? "—" : `${Math.round(weather.tempC)}°C`), [weather.tempC]);

  if (isKiosk) {
    const row = "w-full";
    const queue = kioskWorkQueueRows(model);
    const rightKpis = kioskKpis.slice(0, 4);
    const onSiteShow = model.workforce.onSite.slice(0, 5);
    return (
      <div
        className={cn(
          DASH.page,
          "pulse-dashboard-canvas pulse-operations-dashboard min-h-screen px-2 py-2 sm:px-3 sm:py-3",
        )}
      >
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--ops-dash-border,#cbd5e1)_88%,transparent)] bg-[var(--ops-dash-widget-bg,#ffffff)] px-3 py-2 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.2)] dark:border-white/[0.09] dark:bg-[var(--ops-dash-widget-bg,#0f172a)]">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <OperationsHeaderLogoMark logoUrl={headerLogoUrl} companyName={headerCompanyName} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)] sm:text-sm">
                    <span className="max-w-[min(100%,18rem)] truncate">{dateInBc(now)}</span>
                    <span className="text-ds-muted">•</span>
                    <span className="tabular-nums">{timeInBc(now)}</span>
                    <span className="text-ds-muted">•</span>
                    <span className="inline-flex items-center gap-1 text-ds-muted">
                      <Cloud className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                      <span className="truncate">
                        {weatherTemp} · {weatherLabel}
                      </span>
                    </span>
                  </p>
                  {model.bannerNote ? (
                    <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-snug text-ds-foreground sm:text-xs">{model.bannerNote}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
                  {currentView}
                </div>
                {!hideHeaderWelcome && model.welcomeName.trim() ? (
                  <span className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-lg border border-ds-border bg-ds-secondary/60 px-2 py-1 text-xs font-semibold text-ds-foreground sm:max-w-none sm:px-2.5 sm:text-sm">
                    <span className="hidden sm:inline">Welcome,</span> {model.welcomeName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="col-span-12 min-h-0 lg:col-span-2">
            <OpsWidgetShell title="Today's focus" className="h-full min-h-0">
              <ul className="space-y-1.5">
                {queue.length === 0 ? (
                  <li className="text-xs text-ds-muted sm:text-sm">No queued work items.</li>
                ) : (
                  queue.map((q) => (
                    <li key={q.key} className={cn(DASH.listRow, "flex items-start justify-between gap-2 px-2 py-2")}>
                      <span className="min-w-0 truncate text-xs font-semibold text-ds-foreground sm:text-sm">{q.title}</span>
                      <span
                        className={cn(
                          DASH.pill,
                          "py-px text-[9px]",
                          q.tone === "critical" &&
                            "border-red-200/80 bg-red-50 text-red-800 dark:border-red-500/35 dark:bg-red-950/40 dark:text-red-100",
                          q.tone === "warn" &&
                            "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-100",
                          q.tone === "ok" && "border-ds-border bg-ds-secondary text-ds-muted",
                        )}
                      >
                        {q.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </OpsWidgetShell>
          </div>

          <div className="col-span-12 min-h-0 lg:col-span-8">
            <div className="space-y-2 transition-opacity duration-500 ease-in-out">
              {currentView === "overview" && <OverviewView rowClass={row} />}
              {currentView === "workforce" && <WorkforceView rowClass={row} />}
              {currentView === "systems" && <SystemsView rowClass={row} />}
            </div>
          </div>

          <div className="col-span-12 min-h-0 lg:col-span-2">
            <OpsWidgetShell title="Team snapshot" className="h-full min-h-0">
              <div className="grid grid-cols-2 gap-1.5">
                {rightKpis.map((k) => (
                  <KioskTile key={k.label} label={k.label} value={k.value} />
                ))}
              </div>
              <p className={cn(DASH.sectionLabel, "mt-3 text-[10px]")}>On site</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {onSiteShow.length === 0 ? (
                  <p className="text-xs text-ds-muted">No workers on site.</p>
                ) : (
                  onSiteShow.map((b) => (
                    <WorkforceBubbleStack
                      key={b.id}
                      bubble={b}
                      faceClassName={onsiteAvatarClass()}
                      badges={
                        <>
                          {b.badge ? <WorkforceRoleLetterBadge letter={b.badge} /> : null}
                          {b.attendanceMark ? <WorkforceAttendanceBadge mark={b.attendanceMark} /> : null}
                          <WorkforceStatusDot color="green" />
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </OpsWidgetShell>
          </div>

          <KioskRotateFooter activeIndex={viewIndex} total={views.length} compact />
        </div>
      </div>
    );
  }

  const headerShowLayoutTools = canEditLayout && !readOnly;
  const headerShowFullscreen = !isKiosk;

  return (
    <div className={cn(DASH.page, "space-y-3")}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--ops-dash-border,#cbd5e1)_88%,transparent)] bg-[var(--ops-dash-widget-bg,#ffffff)] px-3 py-2.5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.2)] dark:border-white/[0.09] dark:bg-[var(--ops-dash-widget-bg,#0f172a)]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
            Operations
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">
            {dateInBc(now)} · {timeInBc(now)}
          </p>
        </div>
        {headerShowFullscreen || headerShowLayoutTools ? (
          <div className="inline-flex flex-wrap items-center gap-1" role="group" aria-label="Dashboard actions">
            {headerShowFullscreen ? (
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
            {headerShowFullscreen && headerShowLayoutTools ? <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden /> : null}
            {headerShowLayoutTools ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (editMode) {
                      setIsInteracting(false);
                      setLayout((current) => {
                        const compacted = stableCompactor.compact(current as Layout, DASHBOARD_GRID_COLS) as Layout;
                        persistLayout(compacted);
                        return compacted;
                      });
                    }
                    setEditMode((v) => !v);
                  }}
                  title={editMode ? "Done editing layout" : "Edit dashboard layout"}
                  aria-label={editMode ? "Done editing layout" : "Edit dashboard layout"}
                  aria-pressed={editMode}
                  className={cn(OPS_DASH_HEADER_TOOL, editMode && OPS_DASH_HEADER_TOOL_ACTIVE)}
                >
                  {editMode ? (
                    <Check className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Pencil className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                  )}
                </Button>
                <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddWidget(true)}
                  title="Add a widget"
                  aria-label="Add widget"
                  className={cn(OPS_DASH_HEADER_TOOL, "disabled:pointer-events-none disabled:opacity-40")}
                >
                  <Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {model.bannerNote ? (
        <div className="rounded-xl border border-ds-border bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)] px-3 py-2 text-sm font-medium text-ds-foreground">
          {model.bannerNote}
        </div>
      ) : null}

      <div ref={containerRef as any} className={cn("pulse-dashboard-grid min-w-0", editMode && "pulse-dashboard-edit")}>
          {mounted ? (
            <GridLayout
              layout={layout}
              width={width}
              gridConfig={{
                cols: DASHBOARD_GRID_COLS,
                rowHeight: DASHBOARD_GRID_ROW_HEIGHT_PX,
                margin: [DASHBOARD_GRID_GAP_PX, DASHBOARD_GRID_GAP_PX],
                containerPadding: [0, 0],
              }}
              dragConfig={{
                enabled: canEditLayout && editMode,
                bounded: false,
                // Whole widget is draggable in edit mode; cancel common interactive controls.
                cancel: "button, a, input, textarea, select, option, [role='button'], .dashboard-no-drag",
              }}
              resizeConfig={{
                enabled: canEditLayout && editMode,
                // Allow edge pulls (not just the corner) while respecting each widget's minW/minH.
                handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
              }}
              compactor={activeCompactor}
              onDragStart={() => {
                if (!canEditLayout || !editMode) return;
                setIsInteracting(true);
              }}
              onResizeStart={() => {
                if (!canEditLayout || !editMode) return;
                setIsInteracting(true);
              }}
              onDrag={(next) => {
                if (!canEditLayout || !editMode) return;
                // Keep UI responsive while dragging, but don't persist here.
                setLayout(next as Layout);
              }}
              onResize={(next) => {
                if (!canEditLayout || !editMode) return;
                setLayout(next as Layout);
              }}
              onDragStop={(next) => {
                if (!canEditLayout || !editMode) return;
                setIsInteracting(false);
                const compacted = stableCompactor.compact(next as Layout, DASHBOARD_GRID_COLS) as Layout;
                setLayout(compacted);
                persistLayout(compacted);
              }}
              onResizeStop={(next) => {
                if (!canEditLayout || !editMode) return;
                setIsInteracting(false);
                const compacted = stableCompactor.compact(next as Layout, DASHBOARD_GRID_COLS) as Layout;
                setLayout(compacted);
                persistLayout(compacted);
              }}
            >
              {layout.map((item) => {
                if (item.i.startsWith("cw_")) {
                  const cfg = customConfigs[item.i];
                  if (!cfg) return <div key={item.i} />;
                  const headerRight = !readOnly ? (
                    <div className="flex items-center gap-1">
                      {!editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setPeekWizardInitial(cfg);
                            setPeekWizardMode("edit");
                            setShowPeekWizard(true);
                          }}
                          className="inline-flex h-5 items-center px-1.5 py-0"
                          aria-label="Edit peek widget"
                          title="Edit widget"
                        >
                          <Settings className="h-3 w-3" aria-hidden />
                        </Button>
                      ) : null}
                      {editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeWidget(item.i)}
                          className="h-5 min-w-5 px-0 text-[11px] leading-none"
                          aria-label={`Remove ${cfg.title}`}
                          title="Remove widget"
                        >
                          ×
                        </Button>
                      ) : null}
                    </div>
                  ) : null;
                  return (
                    <div
                      key={item.i}
                      className={["transition-transform", editMode ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
                    >
                      <OpsWidgetShell title={cfg.title} headerRight={headerRight} className="h-full">
                        <DashboardCustomPeekWidget config={cfg} model={model} mode={buildWidgetContext(item).mode} />
                      </OpsWidgetShell>
                    </div>
                  );
                }

                const w = (widgetRegistry as Record<string, unknown>)[item.i] as
                  | {
                      title: string;
                      accent?: string;
                      render: (ctx?: WidgetRenderContext) => ReactNode;
                    }
                  | null
                  | undefined;
                if (!w) return <div key={item.i} />;

                const headerRight =
                  !readOnly && editMode ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => removeWidget(item.i)}
                      className="h-5 min-w-5 px-0 text-[11px] leading-none"
                      aria-label={`Remove ${w.title}`}
                      title="Remove widget"
                    >
                      ×
                    </Button>
                  ) : null;

                return (
                  <div
                    key={item.i}
                    data-guided-tour-anchor={
                      item.i === "notifications_work_orders"
                        ? "dashboard-alerts"
                        : item.i === "workforce"
                          ? "dashboard-workforce"
                          : item.i === "low_inventory"
                            ? "dashboard-inventory"
                            : undefined
                    }
                    className={cn(
                      "transition-transform",
                      editMode && "cursor-grab active:cursor-grabbing",
                      item.i === "co2_monitoring" && "flex h-full min-h-0 flex-col items-stretch justify-start",
                    )}
                  >
                    <OpsWidgetShell
                      title={w.title}
                      headerRight={headerRight}
                      className={item.i === "co2_monitoring" ? "w-full" : "h-full"}
                      contentMode={item.i === "co2_monitoring" ? "hug" : "fill"}
                    >
                      {w.render(buildWidgetContext(item))}
                    </OpsWidgetShell>
                  </div>
                );
              })}
            </GridLayout>
          ) : null}
      </div>

      {showAddWidget ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="ds-modal-backdrop absolute inset-0" onClick={() => setShowAddWidget(false)} aria-hidden />
            <Card className="relative z-10 w-full max-w-md border border-gray-200 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={UI.header}>Add Widget</p>
                  <p className={`mt-1 ${UI.subheader}`}>
                    Re-enable a built-in card, or build a compact &quot;peek&quot; from another Pulse page (pick slices and
                    options).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-w-8 px-2 py-1 text-sm"
                  onClick={() => setShowAddWidget(false)}
                  aria-label="Close add widget dialog"
                >
                  ×
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex w-full items-center justify-between text-left text-sm font-semibold"
                  onClick={() => {
                    setShowAddWidget(false);
                    setPeekWizardInitial(null);
                    setPeekWizardMode("create");
                    setShowPeekWizard(true);
                  }}
                >
                  <span>Custom page peek…</span>
                  <span className="text-xs font-semibold text-blue-600">New</span>
                </Button>
                <p className={`pt-2 text-[11px] font-semibold uppercase tracking-wider ${UI.subheader}`}>
                  Built-in cards
                </p>
                {availableToAdd.length === 0 ? (
                  <p className={`text-sm ${UI.subheader}`}>All built-in widgets are already on the board.</p>
                ) : (
                  availableToAdd.map((key) => {
                    const ww = (widgetRegistry as Record<string, any>)[key] as { title: string } | null | undefined;
                    if (!ww) return null;
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant="secondary"
                        className="flex w-full items-center justify-between text-left text-sm font-semibold"
                        onClick={() => {
                          addWidget(key);
                          setShowAddWidget(false);
                        }}
                      >
                        <span>{ww.title}</span>
                        <span className="text-gray-500">Add</span>
                      </Button>
                    );
                  })
                )}
              </div>
            </Card>
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
  );
}

export type OperationalDashboardVariant = "demo" | "live";

export function OperationalDashboard({
  variant,
  onReady,
  readOnly = false,
  tokenOverride = null,
  dashboardContext = "operations",
}: {
  variant: OperationalDashboardVariant;
  /** Fires once when the dashboard has finished its initial load (live fetch done or demo mounted). */
  onReady?: (payload?: OperationalDashboardReadyPayload) => void;
  /** Kiosk / read-only mode disables layout editing and widget add/remove. */
  readOnly?: boolean;
  /** Optional bearer token for kiosk links (`?token=`) when no session exists. */
  tokenOverride?: string | null;
  dashboardContext?: "operations" | "admin";
}) {
  const { session } = usePulseAuth();
  const [liveModel, setLiveModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(variant === "live");
  const [error, setError] = useState<string | null>(null);
  const [zoneDismissed, setZoneDismissed] = useState(false);
  const readyNotifiedRef = useRef(false);

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
    if (!tokenOverride) {
      if (!sess?.access_token) {
        setLoading(false);
        setError(null);
        setLiveModel(null);
        notifyReady();
        return;
      }
      if (!canAccessPulseTenantApis(sess)) {
        setLoading(false);
        setError(
          sess.is_system_admin === true || sess.role === "system_admin"
            ? "The operations dashboard is for tenant accounts. Sign in with a company user, or open System admin and use impersonation to view a tenant."
            : "Your account is not linked to an organization. Contact your administrator.",
        );
        setLiveModel(null);
        notifyReady();
        return;
      }
    }

    let readyPayload: OperationalDashboardReadyPayload = { criticalCount: 0, warningCount: 0 };

    setLoading(true);
    setError(null);
    // Same local calendar day as `buildLiveModel` / schedule module (exclusive end = next local midnight).
    const { dayStartMs, dayEndMsExclusive } = localCalendarDayBoundsMs(getServerNow());
    const from = new Date(dayStartMs).toISOString();
    const to = new Date(dayEndMsExclusive).toISOString();

    try {
      const [dash, wrList, workers, assetList, lowStock, zoneList, beaconList, trainingMatrix] = await Promise.all([
        fetchJson<DashboardPayload>("/api/v1/pulse/dashboard"),
        fetchJson<WorkRequestListOut>("/api/v1/pulse/work-requests?limit=40&offset=0"),
        fetchJson<WorkerOut[]>("/api/v1/pulse/workers"),
        fetchJson<AssetOut[]>("/api/v1/pulse/assets"),
        fetchJson<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
        fetchJson<ZoneOut[]>("/api/v1/pulse/schedule-facilities"),
        fetchJson<BeaconEquipmentOut[]>("/api/v1/pulse/equipment"),
        fetchTrainingMatrix().catch((e) => {
          const st = (e as { status?: number })?.status;
          if (st === 403 || st === 401) return null;
          throw e;
        }),
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
        trainingMatrix,
      );
      const welcome = welcomeFromSession(auth?.email ?? session?.email, auth?.full_name ?? session?.full_name);
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
    // Re-run when auth profile hydrates so the kiosk welcome line updates without waiting on another fetch.
  }, [fetchJson, notifyReady, tokenOverride, session?.email, session?.full_name]);

  useEffect(() => {
    if (variant !== "live" || !isApiMode()) return;
    void fetchLive();
  }, [variant, fetchLive]);

  useEffect(() => {
    if (variant === "demo") {
      notifyReady(alertCountsFromAlerts(demoModel().alerts));
    }
  }, [variant, notifyReady]);

  const attendanceMarks = useWorkerDayAttendanceStore((s) => s.marks);
  const mergedDemoModel = useMemo(() => {
    const welcome = welcomeFromSession(session?.email, session?.full_name);
    return mergeAttendanceIntoDashboardModel({ ...demoModel(), welcomeName: welcome }, attendanceMarks);
  }, [session?.email, session?.full_name, attendanceMarks]);

  const mergedLiveModel = useMemo(() => {
    if (!liveModel) return null;
    return mergeAttendanceIntoDashboardModel(liveModel, attendanceMarks);
  }, [liveModel, attendanceMarks]);

  if (variant === "demo") {
    return (
      <DashboardBody
        model={mergedDemoModel}
        session={session}
        dashboardContext={dashboardContext}
        workOrdersHref={workOrdersHref}
        headerLogoUrl="/images/panoramalogo2.png"
        headerCompanyName={session?.company?.name ?? null}
        facilitySetupChecklist={null}
        readOnly={readOnly}
      />
    );
  }

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <p className={UI.subheader}>Loading live dashboard…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col gap-4 border border-red-200 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <p className="text-sm text-gray-900" role="status">
            {error}
          </p>
        </div>
        <Button type="button" className="shrink-0 sm:mt-0" onClick={() => void fetchLive()}>
          Retry
        </Button>
      </Card>
    );
  }

  if (!liveModel) {
    return <p className={UI.subheader}>No dashboard data available.</p>;
  }

  return (
    <DashboardBody
      model={mergedLiveModel ?? liveModel}
      session={session}
      dashboardContext={dashboardContext}
      workOrdersHref={workOrdersHref}
      zonePromptDismissed={zoneDismissed}
      onDismissZonePrompt={() => setZoneDismissed(true)}
      headerLogoUrl="/images/panoramalogo2.png"
      headerCompanyName={session?.company?.name ?? null}
      facilitySetupChecklist={null}
      readOnly={readOnly}
    />
  );
}
