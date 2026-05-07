"use client";

import {
  AlertCircle,
  AlertTriangle,
  Battery,
  Check,
  Cloud,
  Info,
  MapPin,
  Monitor,
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
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { XpTasksWidget } from "@/components/gamification/XpTasksWidget";
import { apiFetch, isApiMode } from "@/lib/api";
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseRoutes, pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession, type PulseAuthSession } from "@/lib/pulse-session";
import { canAccessCompanyConfiguration, sessionHasAnyRole } from "@/lib/pulse-roles";
import { getServerDate, getServerNow } from "@/lib/serverTime";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import {
  DASHBOARD_CUSTOM_WIDGETS_STORAGE,
  type CustomDashboardWidgetConfig,
} from "@/lib/dashboardPageWidgetCatalog";
import {
  localScheduleDateKey,
  mergedScheduleShiftsForCalendarDate,
  shiftIntervalBoundsMs,
} from "@/lib/schedule/dashboardScheduleDay";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { DashboardAccentCard, DashboardColumnPanel, KioskRotateFooter } from "@/components/dashboard/DashboardChrome";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";
import { UI } from "@/styles/ui";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type AlertPriority = "critical" | "high" | "medium" | "low";

/** Fixed logical columns — 8-wide grid fits more small widgets per row. */
const DASHBOARD_GRID_COLS = 8;
/** Vertical pitch (~half of legacy 140px for a denser board). */
const DASHBOARD_GRID_ROW_HEIGHT_PX = 72;
/** Horizontal + vertical gutter between cards. */
const DASHBOARD_GRID_GAP_PX = 18;

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
  "h-10 w-10 min-h-0 rounded-lg !border-2 border-ds-border bg-transparent !px-0 !py-0 text-ds-foreground shadow-none transition-colors hover:!border-[var(--ds-accent)] hover:!bg-[color-mix(in_srgb,var(--ds-accent)_14%,var(--ds-bg))] hover:!text-[var(--ds-accent)] focus-visible:!outline-[var(--ds-accent)] dark:hover:!bg-[color-mix(in_srgb,var(--ds-accent)_20%,transparent)]";
const OPS_DASH_HEADER_TOOL_ACTIVE =
  "h-10 w-10 min-h-0 rounded-lg !border-2 !border-[var(--ds-accent)] !bg-[var(--ds-accent)] !px-0 !py-0 !text-white shadow-none transition-colors hover:!border-[var(--ds-accent)] hover:!bg-[color-mix(in_srgb,var(--ds-accent)_88%,#0f172a)] hover:!text-white";

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
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-ds-border/70 bg-[color-mix(in_srgb,var(--ds-primary)_88%,transparent)] shadow-[0_1px_0_rgba(255,255,255,0.65)] dark:bg-ds-secondary/35 dark:shadow-none",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-ds-border/55 px-2.5 py-1.5 sm:px-3 sm:py-2">
        <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">{title}</p>
        {headerRight ? <div className="shrink-0 text-[10px] font-semibold text-ds-muted">{headerRight}</div> : null}
      </div>
      <div className="min-h-0 flex-1 px-2.5 py-2 sm:px-3 sm:py-2.5">{children}</div>
    </div>
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
  const style =
    p === "medium"
      ? ({
          borderLeftColor: "var(--ds-info)",
          background: "color-mix(in srgb, var(--ds-info) 12%, transparent)",
        } as const)
      : undefined;

  const icon =
    p === "critical" ? (
      <AlertTriangle className="h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
    ) : p === "high" ? (
      <AlertCircle className="h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
    ) : p === "medium" ? (
      <Info className="h-4 w-4 shrink-0 text-[var(--ds-info)]" aria-hidden />
    ) : isPad ? (
      <Minus className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
    ) : (
      <Radio className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
    );

  const strip =
    p === "critical"
      ? "border-l-[var(--ds-danger)]"
      : p === "high"
        ? "border-l-ds-warning"
        : p === "medium"
          ? "border-l-[var(--ds-info)]"
          : "border-l-ds-border";

  return (
    <li
      className={cn(
        "flex gap-2 rounded-md border border-ds-border/40 py-2 pl-2 pr-2",
        strip,
        "border-l-[3px]",
        !isPad && p === "critical" && "bg-[color-mix(in_srgb,var(--ds-danger)_7%,transparent)]",
        !isPad && p === "high" && "bg-[color-mix(in_srgb,var(--ds-warning)_8%,transparent)]",
        isPad && "opacity-80",
      )}
      style={p === "medium" ? style : undefined}
    >
      <span className="shrink-0 pt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold leading-snug sm:text-sm ${isPad ? "text-ds-muted" : "text-ds-foreground"}`}>
          {a.title}
        </p>
        {a.subtitle ? (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px] leading-relaxed text-ds-muted">{a.subtitle}</p>
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
      <span className="app-badge-blue shrink-0 border border-blue-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {tag.label}
      </span>
    );
  }
  if (tag.kind === "overdue") {
    return (
      <span className="app-badge-amber shrink-0 inline-flex items-center gap-1 border border-amber-300 px-2 py-0.5 text-[11px] font-bold">
        <span className="h-1.5 w-1.5 bg-current opacity-90" />
        {tag.label}
      </span>
    );
  }
  return (
    <span className="app-badge-red shrink-0 self-start border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
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
    /** v5: 8-column grid + denser default tile heights (v4 was 12-col). */
    return `pulse_dashboard_layout_v5_${dashboardContext}_${mode}`;
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

  const activeAlertRows = useMemo(() => activeAlertCardRows(model.alerts), [model.alerts]);

  const kioskAlerts = useMemo(() => {
    const real = model.alerts
      .filter((a) => a.countsTowardTotals !== false)
      .filter((a) => a.title !== NO_ACTIVE_ALERTS_TITLE)
      .slice()
      .sort(compareAlerts)
      .slice(0, 3);
    if (real.length === 0) return activeAlertRows;
    if (real.length >= 3) return real;
    return [...real, ...activeAlertRows].slice(0, 3);
  }, [activeAlertRows, model.alerts]);

  const mockKPIs = useMemo(
    () => ({
      activeRequests: 7,
      overdue: 2,
      lowStock: 3,
      outOfService: 1,
      onSite: 5,
      completedToday: 12,
    }),
    [],
  );

  const kioskKpis = useMemo(() => {
    return [
      { label: "Active requests", value: mockKPIs.activeRequests },
      { label: "Overdue", value: mockKPIs.overdue },
      { label: "Low stock", value: mockKPIs.lowStock },
      { label: "Out of service", value: mockKPIs.outOfService },
      { label: "On site", value: mockKPIs.onSite },
      { label: "Completed today", value: mockKPIs.completedToday },
    ] as const;
  }, [mockKPIs]);

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
      <div className={DASH.kpiTile}>
        <p className={DASH.kpiLabel}>{label}</p>
        <p className={DASH.kpiValue}>{value}</p>
      </div>
    );
  }

  function KioskPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
      <DashboardColumnPanel title={title} accent="muted">
        {children}
      </DashboardColumnPanel>
    );
  }

  function KioskAlertCard({ alert }: { alert: AlertItem }) {
    const p = alertPriority(alert);
    const icon =
      p === "critical" ? (
        <AlertTriangle className="h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
      ) : p === "high" ? (
        <AlertCircle className="h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
      ) : p === "medium" ? (
        <Info className="h-5 w-5 shrink-0 text-[var(--ds-info)]" aria-hidden />
      ) : (
        <Radio className="h-5 w-5 shrink-0 text-ds-muted" aria-hidden />
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
        <div className="flex gap-3 p-3">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-bold text-ds-foreground max-w-md truncate">{alert.title}</p>
            {alert.subtitle ? (
              <p className="mt-1 text-xs leading-relaxed text-ds-muted max-w-md line-clamp-2 whitespace-pre-line">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kioskKpis.map((k) => (
              <KioskTile key={k.label} label={k.label} value={k.value} />
            ))}
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-3 md:grid-cols-3`}>
          {kioskAlerts.slice(0, 3).map((a, idx) => (
            <KioskAlertCard key={`${a.title}-${idx}`} alert={a} />
          ))}
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-4 md:grid-cols-3`}>
          <div className="col-span-1">
            <KioskPanel title="Workforce">
              <div className="max-w-md">{(widgetRegistry as any).workforce.render()}</div>
            </KioskPanel>
          </div>
          <div className="col-span-1">
            <KioskPanel title="Inventory">
              <div className="max-w-md">{(widgetRegistry as any).inventory.render()}</div>
            </KioskPanel>
          </div>
          <div className="col-span-1">
            <KioskPanel title="Equipment">
              <div className="max-w-md">{(widgetRegistry as any).equipment.render()}</div>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KioskTile label="On site" value={mockKPIs.onSite} />
            <KioskTile label="Active requests" value={mockKPIs.activeRequests} />
            <KioskTile label="Awaiting assignment" value={model.workRequests.awaitingCount} />
            <KioskTile label="Overdue" value={mockKPIs.overdue} />
            <KioskTile label="Completed today" value={mockKPIs.completedToday} />
            <KioskTile label="Shifts today" value={Math.max(0, Number(model.workforce.summaryLine.match(/\d+/)?.[0] ?? 0))} />
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-4 lg:grid-cols-3`}>
          <div className="lg:col-span-2">
            <KioskPanel title="On-site workers">
              <div className="max-w-md">
                <div className="flex flex-wrap gap-3">
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

          <div className="lg:col-span-1">
            <KioskPanel title="Work focus">
              <div className="max-w-md space-y-3">
                <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Assigned vs unassigned</p>
                  <p className="mt-2 text-sm font-semibold text-ds-foreground">
                    Unassigned: <span className="tabular-nums">{model.workRequests.awaitingCount}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ds-foreground">
                    Active: <span className="tabular-nums">{mockKPIs.activeRequests}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Today</p>
                  <p className="mt-2 text-sm font-semibold text-ds-foreground">
                    Completed: <span className="tabular-nums">{mockKPIs.completedToday}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ds-foreground">
                    Overdue: <span className="tabular-nums">{mockKPIs.overdue}</span>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KioskTile label="Low stock" value={mockKPIs.lowStock} />
            <KioskTile label="Out of service" value={mockKPIs.outOfService} />
            <KioskTile label="Missing tools" value={model.equipment.missingCount} />
            <KioskTile label="Active tools" value={model.equipment.activeCount} />
            <KioskTile label="Inventory items" value={model.inventory.shoppingList.length} />
            <KioskTile label="Overdue" value={mockKPIs.overdue} />
          </div>
        </div>

        <div className={`${rowClass} grid grid-cols-1 gap-4 md:grid-cols-3`}>
          <div className="min-w-0">
            <KioskPanel title="Inventory">
              <div className="max-w-md">{(widgetRegistry as any).inventory.render()}</div>
            </KioskPanel>
          </div>
          <div className="min-w-0">
            <KioskPanel title="Equipment">
              <div className="max-w-md">{(widgetRegistry as any).equipment.render()}</div>
            </KioskPanel>
          </div>
          <div className="min-w-0">
            <KioskPanel title="Top alerts">
              <div className="max-w-md space-y-3">
                {kioskAlerts.slice(0, 3).map((a, idx) => (
                  <KioskAlertCard key={`${a.title}-${idx}`} alert={a} />
                ))}
              </div>
            </KioskPanel>
          </div>
        </div>
      </>
    );
  }

  const widgetRegistry = useMemo(() => {
    const queueRows = kioskWorkQueueRows(model);
    const snapshotKpis = kioskKpis.slice(0, 4);
    const onSiteLimited = model.workforce.onSite.slice(0, 5);

    return {
      /** Leadership band widgets — live in the main grid so the whole dashboard is one editable canvas. */
      todays_focus: {
        title: "Today's focus",
        accent: "green" as const,
        render: () => (
          <div className="min-h-0 flex-1 overflow-auto">
            <ul className="divide-y divide-ds-border/50">
              {queueRows.length === 0 ? (
                <li className="py-2 text-xs text-ds-muted">No queued work items.</li>
              ) : (
                queueRows.map((q) => (
                  <li key={q.key} className="flex items-start justify-between gap-2 py-2">
                    <span className="min-w-0 truncate text-xs font-semibold leading-snug text-ds-foreground sm:text-sm">
                      {q.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        q.tone === "critical" && "bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)] text-ds-danger",
                        q.tone === "warn" &&
                          "bg-[color-mix(in_srgb,var(--ds-warning)_16%,transparent)] text-amber-900 dark:text-amber-100",
                        q.tone === "ok" && "bg-ds-secondary/80 text-ds-muted",
                      )}
                    >
                      {q.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ),
      },
      leadership_overview: {
        title: "Operational overview",
        accent: "none" as const,
        render: () => (
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-0.5">
            <div className="flex flex-wrap gap-1.5">
              {kioskKpis.map((k) => (
                <div
                  key={k.label}
                  className="flex min-w-[5.5rem] items-baseline gap-1.5 rounded-md bg-ds-secondary/55 px-2 py-1 dark:bg-ds-secondary/40"
                >
                  <span className="text-[10px] font-semibold uppercase leading-none text-ds-muted">{k.label}</span>
                  <span className="text-sm font-bold tabular-nums text-ds-foreground">{k.value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {kioskAlerts.slice(0, 3).map((a, idx) => {
                const p = alertPriority(a);
                const strip =
                  p === "critical"
                    ? "border-l-[var(--ds-danger)]"
                    : p === "high"
                      ? "border-l-ds-warning"
                      : p === "medium"
                        ? "border-l-[var(--ds-info)]"
                        : "border-l-ds-border";
                return (
                  <div
                    key={`${a.title}-${idx}`}
                    className={cn(
                      "flex min-w-0 gap-2 rounded-md border border-ds-border/35 py-1.5 pl-2 pr-1.5 text-xs",
                      strip,
                      "border-l-[3px]",
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold text-ds-foreground">{a.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      },
      team_snapshot: {
        title: "Team snapshot",
        accent: "none" as const,
        render: () => (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {snapshotKpis.map((k) => (
                <div key={k.label} className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase leading-tight text-ds-muted">{k.label}</p>
                  <p className="text-base font-bold tabular-nums leading-none text-ds-foreground">{k.value}</p>
                </div>
              ))}
            </div>
            <p className={cn(DASH.sectionLabel, "mt-3")}>On site</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {onSiteLimited.length === 0 ? (
                <p className="text-xs text-ds-muted">No workers on site.</p>
              ) : (
                onSiteLimited.map((b) => (
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
        ),
      },
      alerts: {
        title: "Active Alerts",
        accent: "yellow" as const,
        render: () => (
          <ul className="flex flex-1 flex-col gap-2">
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
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-ds-foreground">Today – {model.workforce.dateLabel}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">{model.workforce.summaryLine}</p>
            </div>

            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ds-success">On site</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {model.workforce.onSite.length === 0 ? (
                    <p className="text-xs text-ds-muted">No one on site</p>
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

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ds-info)]">On shift</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {model.workforce.onShiftNow.length === 0 ? (
                    <p className="text-xs text-ds-muted">—</p>
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
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ds-info)]">Upcoming</p>
                  <div className="mt-1 flex flex-wrap gap-2">
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
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Scheduled today
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
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
                <div className="border-t border-ds-border/60 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Off site</p>
                  <div className="mt-1 flex flex-wrap gap-2 opacity-90">
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
          </div>
        ),
      },
      workRequests: {
        title: "Work Requests",
        accent: "red" as const,
        render: () => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md bg-ds-secondary/80 px-2 py-1 text-[11px] font-bold text-ds-foreground">
                {model.workRequests.awaitingCount} awaiting assignment
              </span>
              <Link href={workOrdersHref} className="ds-link text-[11px] font-semibold">
                Work orders →
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {model.workRequests.newest ? (
                <div className="border-b border-ds-border/50 pb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Newest</p>
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ds-foreground">{model.workRequests.newest.title}</p>
                      <p className="mt-0.5 text-[11px] text-ds-muted">{model.workRequests.newest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.newest.tag} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ds-muted">
                  No open requests.{" "}
                  <Link href={workOrdersHref} className="ds-link">
                    Open work orders
                  </Link>
                </p>
              )}

              {model.workRequests.oldest ? (
                <div className="border-b border-ds-border/50 pb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Oldest</p>
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ds-foreground">{model.workRequests.oldest.title}</p>
                      <p className="mt-0.5 text-[11px] text-ds-muted">{model.workRequests.oldest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.oldest.tag} />
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ds-danger">Critical</p>
                {model.workRequests.critical.length === 0 ? (
                  <p className="mt-1 text-xs text-ds-muted">None right now.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {model.workRequests.critical.map((row) => (
                      <li
                        key={row.title}
                        className="flex gap-2 rounded-md border-l-[3px] border-l-ds-danger bg-[color-mix(in_srgb,var(--ds-danger)_6%,transparent)] py-1.5 pl-2 pr-1"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-ds-foreground">{row.title}</p>
                          <p className="text-[11px] text-ds-muted">{row.subtitle}</p>
                        </div>
                        <span className="shrink-0 self-start rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-800 dark:bg-red-950/50 dark:text-red-100">
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
            <p className="text-lg font-bold tabular-nums text-ds-foreground sm:text-xl">
              {model.equipment.activeCount}{" "}
              <span className="text-sm font-semibold text-ds-muted">active tools</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-ds-secondary/80 px-2 py-0.5 text-[11px] font-semibold text-ds-foreground">
                {model.equipment.missingCount} missing
              </span>
              <span className="rounded-md bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-ds-danger">
                {model.equipment.outOfServiceCount} out of service
              </span>
            </div>
            <div className="mt-3 flex flex-1 flex-col gap-2 border-t border-ds-border/50 pt-2">
              {model.equipment.showZonePrompt && !zonePromptDismissed ? (
                <div className="flex gap-2 rounded-md border-l-[3px] border-l-ds-warning bg-[color-mix(in_srgb,var(--ds-warning)_8%,transparent)] py-2 pl-2 pr-1">
                  <MapPin className="h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug text-ds-foreground">
                      Tools may need zone checks — schedule a cleanup?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ButtonLink
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        className="!min-h-0 !px-2 !py-1 text-[11px]"
                      >
                        Review inventory
                      </ButtonLink>
                      <Button type="button" variant="secondary" className="!min-h-0 !px-2 !py-1 text-[11px]" onClick={onDismissZonePrompt}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              {model.equipment.showBatteryNote ? (
                <div className="flex gap-2 text-[11px] leading-snug text-ds-foreground">
                  <Battery className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                  <p className="min-w-0 text-ds-muted">Confirm beacon batteries and swaps before the next shift.</p>
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
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ds-foreground">Consumables</p>
                <p className="mt-0.5 text-[11px] text-ds-muted">
                  {model.inventory.consumablesOk ? "Within target range" : "Needs attention"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                  model.inventory.consumablesOk
                    ? "bg-ds-secondary/80 text-ds-foreground"
                    : "bg-[color-mix(in_srgb,var(--ds-info)_16%,transparent)] text-[var(--ds-info)]"
                }`}
              >
                {model.inventory.consumablesOk ? "OK" : "Review"}
              </span>
            </div>

            {model.inventory.alert ? (
              <div className="rounded-md border-l-[3px] border-l-ds-warning bg-[color-mix(in_srgb,var(--ds-warning)_8%,transparent)] py-2 pl-2 pr-1">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-ds-foreground">{model.inventory.alert.category}</p>
                    <p className="mt-0.5 text-[11px] text-ds-muted">{model.inventory.alert.message}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ButtonLink
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        variant="secondary"
                        className="!min-h-0 !px-2 !py-1 text-[11px]"
                      >
                        View stock
                      </ButtonLink>
                      <ButtonLink
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        className="!min-h-0 !px-2 !py-1 text-[11px]"
                      >
                        Order
                      </ButtonLink>
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-ds-secondary/80 px-1.5 py-0.5 text-[10px] font-semibold text-ds-muted">
                    Soon
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ds-muted">No low-stock alerts.</p>
            )}

            <div className="border-t border-ds-border/50 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Shopping list</p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-1 text-xs text-ds-muted">Empty.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {model.inventory.shoppingList.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-ds-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-muted" aria-hidden />
                      <span className="min-w-0 truncate">{item}</span>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kiosk paths + model cover upstream data.
  }, [activeAlertRows, facilitySetupChecklist, kioskAlerts, kioskKpis, model, onDismissZonePrompt, workOrdersHref, zonePromptDismissed]);

  const allWidgetKeys = useMemo(() => {
    return Object.keys(widgetRegistry).filter((k) => (widgetRegistry as Record<string, unknown>)[k] != null);
  }, [widgetRegistry]);

  const defaultLayout = useMemo((): Layout => {
    /** 8-column grid; heights ~half of prior 12-col defaults for denser tiles. */
    const leadershipBand: Layout = [
      { i: "todays_focus", x: 0, y: 0, w: 2, h: 5, minW: 2, minH: 3 },
      { i: "leadership_overview", x: 2, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
      { i: "team_snapshot", x: 6, y: 0, w: 2, h: 5, minW: 2, minH: 3 },
    ];
    const core: Layout = [
      { i: "alerts", x: 0, y: 5, w: 8, h: 2, minW: 3, minH: 2 },
      { i: "workforce", x: 0, y: 7, w: 2, h: 2, minW: 2, minH: 2 },
      { i: "inventory", x: 2, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
      { i: "equipment", x: 5, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
      { i: "workRequests", x: 0, y: 9, w: 8, h: 2, minW: 3, minH: 2 },
      { i: "xp", x: 0, y: 11, w: 8, h: 2, minW: 3, minH: 2 },
    ];
    if (!widgetRegistry.setup) return [...leadershipBand, ...core];
    const setupOffset = 2;
    return [
      { i: "setup", x: 0, y: 0, w: 8, h: setupOffset, minW: 3, minH: 2 },
      ...leadershipBand.map((it) => ({ ...it, y: it.y + setupOffset })),
      ...core.map((it) => ({ ...it, y: it.y + setupOffset })),
    ];
  }, [widgetRegistry.setup]);

  const [layout, setLayout] = useState<Layout>(defaultLayout);

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
    try {
      const v3 = window.localStorage.getItem(layoutStorageKey);
      if (v3) nextLayout = JSON.parse(v3) as Layout;
    } catch {
      nextLayout = null;
    }
    // Do not load pre-v5 12-column layouts into the 8-col grid (they overlap after bounds correction).
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
    const merged = sanitizeLayoutForGrid([...filtered, ...missing] as Layout, DASHBOARD_GRID_COLS);
    setLayout(merged);
    setCustomConfigs(parsedConfigs);
    setLayoutHydrated(true);
  }, [allWidgetKeys, customWidgetStorageKey, dashboardContext, defaultLayout, isKiosk, layoutStorageKey]);

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [layout, layoutHydrated, layoutStorageKey]);

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
      const next: LayoutItem = base ?? { i: id, x: 0, y: Infinity, w: 4, h: 2 };
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

  if (isKiosk) {
    const row = "w-full";
    const queue = kioskWorkQueueRows(model);
    const rightKpis = kioskKpis.slice(0, 4);
    const onSiteShow = model.workforce.onSite.slice(0, 5);
    return (
      <div className={cn(DASH.page, DASH.kioskFrame)}>
        <div className={DASH.grid12}>
          <div className="col-span-12">
            <DashboardAccentCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <OperationsHeaderLogoMark logoUrl={headerLogoUrl} companyName={headerCompanyName} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ds-foreground">
                      <span className="max-w-md truncate">{dateInBc(now)}</span>
                      <span className="text-ds-muted">•</span>
                      <span className="tabular-nums">{timeInBc(now)}</span>
                      <span className="text-ds-muted">•</span>
                      <span className="inline-flex items-center gap-1.5 text-ds-muted">
                        <Cloud className="h-4 w-4" aria-hidden />
                        {weatherTemp} · {weatherLabel}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-semibold text-ds-muted">{currentView.toUpperCase()}</div>
                  {!hideHeaderWelcome && model.welcomeName.trim() ? (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary/60 px-3 py-2 text-sm font-semibold text-ds-foreground">
                      <span className="hidden sm:inline">Welcome,</span> {model.welcomeName}
                    </span>
                  ) : null}
                </div>
              </div>
              {model.bannerNote ? (
                <div className="mt-3 max-w-md border-t border-ds-border pt-3 text-sm font-semibold text-ds-foreground">
                  {model.bannerNote}
                </div>
              ) : null}
            </DashboardAccentCard>
          </div>

          <div className="col-span-12 min-h-0 lg:col-span-3">
            <DashboardColumnPanel title="Today's focus" accent="teal">
              <ul className="space-y-2">
                {queue.length === 0 ? (
                  <li className="text-sm text-ds-muted">No queued work items.</li>
                ) : (
                  queue.map((q) => (
                    <li key={q.key} className={cn(DASH.listRow, "flex items-start justify-between gap-2")}>
                      <span className="min-w-0 truncate text-sm font-semibold text-ds-foreground">{q.title}</span>
                      <span
                        className={cn(
                          DASH.pill,
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
            </DashboardColumnPanel>
          </div>

          <div className="col-span-12 min-h-0 lg:col-span-6">
            <div className="transition-opacity duration-500 ease-in-out">
              {currentView === "overview" && <OverviewView rowClass={row} />}
              {currentView === "workforce" && <WorkforceView rowClass={row} />}
              {currentView === "systems" && <SystemsView rowClass={row} />}
            </div>
          </div>

          <div className="col-span-12 min-h-0 space-y-3 lg:col-span-3">
            <DashboardColumnPanel title="Team snapshot" accent="dusk">
              <div className="grid grid-cols-2 gap-2">
                {rightKpis.map((k) => (
                  <KioskTile key={k.label} label={k.label} value={k.value} />
                ))}
              </div>
              <p className={cn(DASH.sectionLabel, "mt-4")}>On site</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onSiteShow.length === 0 ? (
                  <p className="text-sm text-ds-muted">No workers on site.</p>
                ) : (
                  onSiteShow.map((b) => (
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
            </DashboardColumnPanel>
          </div>

          <KioskRotateFooter activeIndex={viewIndex} total={views.length} />
        </div>
      </div>
    );
  }

  const headerShowWelcome = !hideHeaderWelcome && Boolean(model.welcomeName.trim());
  const headerShowLayoutTools = canEditLayout && !readOnly;
  const headerShowFullscreen = !isKiosk;

  return (
    <div className={cn(DASH.page, "space-y-6")}>
      <DashboardAccentCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={cn(DASH.sectionLabel)}>Operations dashboard</p>
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerShowFullscreen || headerShowLayoutTools || headerShowWelcome ? (
              <div
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-ds-border bg-ds-primary p-1 shadow-sm dark:bg-ds-secondary/70"
                role="group"
                aria-label="Dashboard header actions"
              >
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
                {headerShowFullscreen && (headerShowLayoutTools || headerShowWelcome) ? (
                  <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden />
                ) : null}
                {headerShowLayoutTools ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditMode((v) => !v)}
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
                      disabled={!editMode}
                      onClick={() => editMode && setShowAddWidget(true)}
                      title={editMode ? "Add a widget" : "Turn on edit mode to add widgets"}
                      aria-label="Add widget"
                      className={cn(OPS_DASH_HEADER_TOOL, "disabled:pointer-events-none disabled:opacity-40")}
                    >
                      <Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
                    </Button>
                  </>
                ) : null}
                {headerShowLayoutTools && headerShowWelcome ? (
                  <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden />
                ) : null}
                {headerShowWelcome ? (
                  <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 truncate rounded-full bg-[var(--ds-accent)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm sm:max-w-[20rem]">
                    <span className="hidden sm:inline">Welcome,</span>
                    <span className="truncate">{model.welcomeName}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {model.bannerNote ? (
          <div className="mt-4 border-t border-ds-border pt-4 text-sm font-semibold text-ds-foreground">{model.bannerNote}</div>
        ) : null}
      </DashboardAccentCard>

      <DashboardAccentCard mutedAccent innerClassName="space-y-0">
        <div
          ref={containerRef as any}
          className={["pulse-dashboard-grid min-w-0", editMode ? "pulse-dashboard-edit" : ""].filter(Boolean).join(" ")}
        >
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
              compactor={noCompactor}
              onLayoutChange={(next) => {
                if (!canEditLayout || !editMode) return;
                setLayout(next as Layout);
              }}
            >
              {layout.map((item) => {
                if (item.i.startsWith("cw_")) {
                  const cfg = customConfigs[item.i];
                  if (!cfg) return <div key={item.i} />;
                  const headerRight = !readOnly ? (
                    <div className="flex items-center gap-2">
                      {!editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setPeekWizardInitial(cfg);
                            setPeekWizardMode("edit");
                            setShowPeekWizard(true);
                          }}
                          className="inline-flex items-center px-2 py-1"
                          aria-label="Customize peek widget"
                          title="Customize"
                        >
                          <Settings className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      ) : null}
                      {!readOnly && editMode ? (
                        <span className="dashboard-drag-handle select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                      ) : null}
                      {!readOnly && editMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeWidget(item.i)}
                          className="min-w-8 px-2 py-1 text-xs"
                          aria-label={`Remove ${cfg.title}`}
                          title="Remove widget"
                        >
                          ×
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeWidget(item.i)}
                          className="min-w-8 px-2 py-1 text-xs"
                          aria-label={`Remove ${cfg.title}`}
                          title="Remove widget"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ) : null;
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
                      <>
                        <span className="dashboard-drag-handle select-none border border-gray-800 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Drag
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeWidget(item.i)}
                          className="min-w-8 px-2 py-1 text-xs"
                          aria-label={`Remove ${w.title}`}
                          title="Remove widget"
                        >
                          ×
                        </Button>
                      </>
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
                    <WorkerDashCard
                      title={w.title}
                      headerRight={headerRight}
                      className={["h-full", item.i === "setup" ? "ds-scroll overflow-auto" : ""].join(" ")}
                    >
                      {w.render()}
                    </WorkerDashCard>
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
      </DashboardAccentCard>
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
      const [dash, wrList, workers, assetList, lowStock, zoneList, beaconList] = await Promise.all([
        fetchJson<DashboardPayload>("/api/v1/pulse/dashboard"),
        fetchJson<WorkRequestListOut>("/api/v1/pulse/work-requests?limit=40&offset=0"),
        fetchJson<WorkerOut[]>("/api/v1/pulse/workers"),
        fetchJson<AssetOut[]>("/api/v1/pulse/assets"),
        fetchJson<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
        fetchJson<ZoneOut[]>("/api/v1/pulse/schedule-facilities"),
        fetchJson<BeaconEquipmentOut[]>("/api/v1/pulse/equipment"),
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

  if (variant === "demo") {
    const welcome = welcomeFromSession(session?.email, session?.full_name);
    const demoWithUser: DashboardViewModel = { ...demoModel(), welcomeName: welcome };
    return (
      <DashboardBody
        model={demoWithUser}
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
      model={liveModel}
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
