"use client";

import { AlertTriangle, Check, Monitor, Pencil, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useContainerWidth } from "react-grid-layout";
import { WorkspaceDashboard } from "@/components/dashboard/engine/WorkspaceDashboard";
import { DashboardAddWidgetWizard } from "@/components/dashboard/DashboardAddWidgetWizard";
import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { DashboardCustomPeekWidget } from "@/components/dashboard/DashboardCustomPeekWidget";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiFetch, isApiMode } from "@/lib/api";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseApp, pulseAppHref, pulseTenantNav } from "@/lib/pulse-app";
import { catalogPage } from "@/lib/dashboardPageWidgetCatalog";
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
import { shiftBandForWindow } from "@/lib/schedule/shift-codes";
import type { Shift } from "@/lib/schedule/types";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { OpsHeaderWeather } from "@/components/dashboard/OpsHeaderWeather";
import { OpsWidgetShell } from "@/components/dashboard/widgets/ops/OpsWidgetShell";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";
import { UI } from "@/styles/ui";
import { buildWorkspaceRenderContext, type DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { workforceTierFlags } from "@/lib/dashboard/widget-layout-modes";
import { WidgetAdaptiveBody } from "@/components/dashboard/widgets/WidgetAdaptiveBody";
import {
  addWorkspaceWidget,
  allWorkspaceWidgetIds,
  defaultWorkspaceLayout,
  isLegacyGridLayout,
  mergeMissingDefaults,
  migrateGridLayoutToWorkspace,
  parseWorkspaceLayout,
  removeWorkspaceWidget,
  sanitizeWorkspaceLayout,
  widgetZoneClass,
  workspaceLayoutIsEmpty,
  type WorkspaceLayout,
  type WorkspaceWidgetSlot,
} from "@/lib/dashboard/workspace-layout";
import { DASHBOARD_LAYOUT_STORAGE_VERSION } from "@/lib/dashboard/tokens";
import { TrainingComplianceWidget } from "@/components/dashboard/widgets/training/TrainingComplianceWidget";
import { ImportantDatesOpsWidget } from "@/components/dashboard/widgets/ops/ImportantDatesOpsWidget";
import { NotificationsWorkOrdersOpsWidget } from "@/components/dashboard/widgets/ops/NotificationsWorkOrdersOpsWidget";
import { WORK_REQUESTS_WIDGET_ID } from "@/components/dashboard/widgets/ops/work-requests-widget-layout";
import { LowInventoryOpsWidget } from "@/components/dashboard/widgets/ops/LowInventoryOpsWidget";
import { Co2MonitoringOpsWidget } from "@/components/dashboard/widgets/ops/Co2MonitoringOpsWidget";
import { PoolReadingsOpsWidget } from "@/components/dashboard/widgets/ops/PoolReadingsOpsWidget";
import { FacilityScheduleOpsWidget } from "@/components/dashboard/widgets/ops/FacilityScheduleOpsWidget";
import { RoutineAssignmentsOpsWidget } from "@/components/dashboard/widgets/ops/RoutineAssignmentsOpsWidget";
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { fetchWorkRequestKpiSummary } from "@/lib/work-requests/kpi-summary";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import {
  buildOperationalNotificationItems,
  notificationCountsFromAlerts,
  type OperationalNotificationItem,
} from "@/lib/dashboard/operational-notifications";
import { useOperationalNotificationsStore } from "@/lib/dashboard/operational-notifications-store";

const OPS_DASH_HEADER_TOOL = "ops-dash-header-icon-btn";
const OPS_DASH_HEADER_TOOL_ACTIVE = "ops-dash-header-icon-btn--active";

const BC_TZ = "America/Vancouver";

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
  /**
   * Sort key for roster ordering: Day (0) → Afternoon (1) → Night (2) → unknown (3),
   * derived from today’s shift window(s).
   */
  displayBandRank: number;
  /** Earliest today shift interval start (ms); used to order upcoming roster before role tier. */
  rosterNextStartMs: number | null;
};

type WorkTag = { kind: "progress" | "overdue" | "urgent"; label: string };

export type DashboardViewModel = {
  title: string;
  welcomeName: string;
  /** Short banner when demo or guided telemetry is active for this tenant. */
  bannerNote: string | null;
  alerts: OperationalNotificationItem[];
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
    /** Leadership snapshot — pending / in progress / overdue / active total (from work-requests API). */
    kpi: {
      pendingApproval: number;
      inProgress: number;
      overdueAny: number;
      total: number;
    } | null;
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
    skippedSlots: number;
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

/** Dashboard workforce bubbles — soft neumorphic glass; photo replaces initials when `avatar_url` resolves. */
const workforceAvatarGoldBase = "ops-workforce-avatar";

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

function shiftCodeBandSortRank(code: ReturnType<typeof shiftBandForWindow>): number {
  if (code === "D") return 0;
  if (code === "A") return 1;
  return 2;
}

/** Day → Afternoon → Night for dashboard roster, using the same window rules as schedule shift codes. */
function displayBandRankForWorkerShifts(
  mineRows: Shift[],
  apiBoundsById: Map<string, Pick<PulseShiftApi, "starts_at" | "ends_at">>,
  now: number,
  active: boolean,
  nextStart: number | null,
): number {
  const paired = mineRows
    .map((s) => ({ s, iv: shiftIntervalBoundsMs(s, apiBoundsById) }))
    .filter((x): x is { s: Shift; iv: { startMs: number; endMs: number } } => x.iv != null);
  if (paired.length === 0) return 3;

  if (active) {
    const hit = paired.find(({ iv }) => iv.startMs <= now && now < iv.endMs);
    if (hit) return shiftCodeBandSortRank(shiftBandForWindow(hit.s.startTime, hit.s.endTime));
  }

  if (nextStart != null && now < nextStart) {
    const atNext = paired.filter(({ iv }) => iv.startMs === nextStart);
    const pick = atNext[0] ?? paired.find(({ iv }) => iv.startMs >= now);
    if (pick) return shiftCodeBandSortRank(shiftBandForWindow(pick.s.startTime, pick.s.endTime));
  }

  const sorted = [...paired].sort((a, b) => a.iv.startMs - b.iv.startMs || a.iv.endMs - b.iv.endMs);
  const first = sorted[0]?.s;
  if (first) return shiftCodeBandSortRank(shiftBandForWindow(first.startTime, first.endTime));
  return 3;
}

function sortScheduledTodayRoster(a: WorkforceBubble, b: WorkforceBubble): number {
  const d = rosterDisplayOrder(a) - rosterDisplayOrder(b);
  if (d !== 0) return d;
  const band = a.displayBandRank - b.displayBandRank;
  if (band !== 0) return band;
  const ta = a.rosterNextStartMs ?? Number.POSITIVE_INFINITY;
  const tb = b.rosterNextStartMs ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return sortWorkforceByRoleThenName(a, b);
}

function onsiteAvatarClass() {
  return `relative flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs transition-transform md:h-12 md:w-12 md:text-sm`;
}

function offsiteAvatarClass() {
  return `relative flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs md:h-12 md:w-12 md:text-sm`;
}

/** “Scheduled today” roster faces — fixed size so grid columns don’t inflate avatars to the full column width. */
function scheduledAvatarFaceClass() {
  return cn(
    "relative mx-auto mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12",
    workforceAvatarGoldBase,
    "text-xs font-semibold leading-none sm:text-sm",
  );
}

/** Same as {@link scheduledAvatarFaceClass}; some call sites still reference this name. */
const scheduledAvatarClass = scheduledAvatarFaceClass;

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

function WorkforceCountStrip({ counts }: { counts: DashboardViewModel["workforce"]["counts"] }) {
  const chips = [
    { label: "On site", value: counts.onSite, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "On shift", value: counts.onShiftNow, tone: "text-[var(--ds-accent)]" },
    { label: "Upcoming", value: counts.upcomingToday, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Off site", value: counts.offSite, tone: "text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="rounded-lg bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] px-2.5 py-2 text-center"
        >
          <p className={cn("text-lg font-bold tabular-nums leading-none", chip.tone)}>{chip.value}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
            {chip.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function isWorkforceRosterNowGroup(b: WorkforceBubble): boolean {
  return b.presence.status === "on_site" || b.scheduleBucket === "on_shift_now";
}

function isWorkforceRosterUpcomingGroup(b: WorkforceBubble): boolean {
  return b.scheduleBucket === "upcoming_today";
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
    <span className="flex w-auto max-w-[9rem] min-w-0 shrink-0 flex-col items-center gap-1 py-0.5">
      <span title={bubble.title} className={faceClassName}>
        <WorkforceBubbleFaceContent
          initials={bubble.initials}
          resolvedSrc={resolvedSrc}
          photoAlt={bubble.displayName}
        />
        {badges}
      </span>
      {showNameLabel ? (
        <span className="w-full max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight text-black sm:text-[11px] dark:text-white">
          {bubble.displayName}
        </span>
      ) : null}
      {status ? (
        <span className="w-full max-w-full px-0.5 text-center text-[9px] leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)] sm:text-[10px]">
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
      displayBandRank: 0,
      rosterNextStartMs: null,
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
      displayBandRank: 1,
      rosterNextStartMs: null,
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
      displayBandRank: 2,
      rosterNextStartMs: null,
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
      displayBandRank: 3,
      rosterNextStartMs: null,
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
    alerts: (() => {
      const t0 = getServerNow();
      let s = 0;
      const bump = () => {
        s += 1;
        return t0 + s;
      };
      return [
        {
          id: "demo-missing-hammer",
          severity: "critical" as const,
          priority: "critical" as const,
          title: "Missing Hammer Drill",
          subtitle: "Last seen: Boiler Room\nZone 3 (Garage)",
          eventAtMs: bump(),
        },
        {
          id: "demo-zone-offline",
          severity: "warning" as const,
          priority: "high" as const,
          title: "Zone 3 (Garage) Offline",
          subtitle: "Status: Planned",
          eventAtMs: bump(),
        },
        {
          id: "demo-beacon-battery",
          severity: "warning" as const,
          priority: "medium" as const,
          title: "Low Beacon Battery",
          subtitle: "Zone 2 anchor · swap pack before next shift",
          eventAtMs: bump(),
        },
      ];
    })(),
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
      kpi: { pendingApproval: 2, inProgress: 4, overdueAny: 1, total: 12 },
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
      skippedSlots: 0,
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
    /** Earliest interval that has not started yet (ignore finished morning blocks when afternoon is still ahead). */
    const futureStarts = intervals.map((iv) => iv.startMs).filter((t) => t > now);
    const nextStart = futureStarts.length === 0 ? null : Math.min(...futureStarts);

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

    const isUpcomingToday = nextStart != null && nextStart < dayEndMsExclusive;

    const isOffSite = presence.status === "off_site" || lastEvent?.type === "exit";

    const lastEndMs =
      intervals.length === 0 ? null : Math.max(...intervals.map((iv) => iv.endMs));
    /** Every assigned interval for this calendar day has ended (not between two shifts today). */
    const allShiftsEndedForDay =
      lastEndMs != null && Number.isFinite(lastEndMs) && lastEndMs <= now && !active;

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
              : allShiftsEndedForDay
                ? `${titleBase} · Shift over`
                : `${titleBase} · Scheduled today`;

    const { badge, rank: roleSortRank } = workforceRoleBadgeAndRank(w?.role ?? "worker");
    const displayName = w ? w.full_name?.trim() || w.email.split("@")[0] || w.email : "Unknown assignee";
    const displayBandRank = displayBandRankForWorkerShifts(mineRows, apiBoundsById, now, active, nextStart);
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
      displayBandRank,
      rosterNextStartMs: nextStart,
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
    .sort(sortScheduledTodayRoster);
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

  const alerts = buildOperationalNotificationItems({
    dashboard,
    assets,
    lowStock,
    zones,
    nowMs: now,
  });

  const invAlert =
    lowStock[0] != null
      ? {
          category: lowStock[0].name.split(/[\s/]/)[0] ?? "Inventory",
          message: `Resupply soon — ${lowStock[0].name} at or below threshold`,
        }
      : null;

  const training = (() => {
    if (!trainingMatrix) {
      return {
        totalSlots: 0,
        skippedSlots: 0,
        completed: 0,
        expiringSoon: 0,
        missing: 0,
        overallCompliancePercent: 0,
      };
    }
    const programs = mapApiPrograms(trainingMatrix.programs);
    const employees = mapApiEmployees(trainingMatrix.employees);
    const assignments = mapApiAssignments(trainingMatrix.assignments);
    const sum = computeComplianceRadialSummary(employees, programs, assignments, [], { trustAssignmentStatus: true });
    return {
      totalSlots: sum.totalSlots,
      skippedSlots: sum.skippedSlots,
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
      kpi: null,
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

function DashboardBody({
  model,
  session,
  dashboardContext,
  workOrdersHref,
  readOnly = false,
  workRequestKpiLoading = false,
}: {
  model: DashboardViewModel;
  session: PulseAuthSession | null | undefined;
  dashboardContext: string;
  workOrdersHref: string;
  readOnly?: boolean;
  workRequestKpiLoading?: boolean;
}) {
  const pathname = usePathname();
  const isKiosk = pathname.startsWith("/kiosk/");
  const openKiosk = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(`${window.location.origin}/kiosk/overview`, "_blank", "noopener,noreferrer");
  }, []);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const isDeptDashboard = dashboardContext.startsWith("dept_");
  const canEditLayout = useMemo(() => {
    if (readOnly || isKiosk) return false;
    if (isDeptDashboard) return true;
    return canAccessCompanyConfiguration(session);
  }, [isDeptDashboard, isKiosk, readOnly, session]);

  /** Kiosk fullscreen uses the same persisted layout as the in-app dashboard (not a separate TV layout). */
  const layoutStorageKey = useMemo(() => {
    return `pulse_dashboard_layout_v${DASHBOARD_LAYOUT_STORAGE_VERSION}_${dashboardContext}_standard`;
  }, [dashboardContext]);

  const customWidgetStorageKey = useMemo(() => {
    return `pulse_dashboard_widgets_v3_${dashboardContext}_standard`;
  }, [dashboardContext]);

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

  const widgetRegistry = useMemo(() => {
    const workforceCardShell = "ops-dash-inner-card flex min-h-0 flex-1 flex-col gap-2 px-1.5 py-3";

    return {
      important_dates: {
        title: "Important dates",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/schedule"),
        shellJumpLabel: "Open schedule",
        render: (ctx?: DashboardWidgetRenderContext) => <ImportantDatesOpsWidget layoutContext={ctx} />,
      },
      notifications_work_orders: {
        title: "Work requests",
        accent: "none" as const,
        shellJumpHref: pulseApp.to(workOrdersHref),
        shellJumpLabel: "Open work requests",
        render: (ctx?: DashboardWidgetRenderContext) => (
          <NotificationsWorkOrdersOpsWidget model={model} kpiLoading={workRequestKpiLoading} layoutContext={ctx} />
        ),
      },
      training_compliance: {
        title: "Training compliance",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/standards/training/compliance#training-matrix"),
        shellJumpLabel: "Open training matrix",
        render: (ctx?: DashboardWidgetRenderContext) => (
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
        render: (ctx?: DashboardWidgetRenderContext) => {
          const tier = ctx?.heightTier ?? "expanded";
          const zone = ctx?.zone ?? "hero";
          const flags = workforceTierFlags(tier);
          const rosterMinH =
            tier === "compact" ? "min-h-0" : tier === "tall" ? "min-h-[10rem]" : "min-h-[7.25rem]";

          return (
          <WidgetAdaptiveBody
            tier={tier}
            zone={zone}
            className={cn(workforceCardShell, "overflow-x-auto overflow-y-visible")}
          >
            <div className="shrink-0">
              <p className="text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
                Today – {model.workforce.dateLabel}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                {model.workforce.summaryLine}
              </p>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-2">
              {flags.showCountStrip && !flags.showRoster ? (
                <WorkforceCountStrip counts={model.workforce.counts} />
              ) : null}
              {flags.showRoster ? (
              <div className={cn("flex min-w-0 flex-1 flex-col py-0.5", rosterMinH)}>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ds-accent)]">Scheduled today</p>
                {model.workforce.scheduledTodayRoster.length === 0 ? (
                  <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                    No shifts on the roster for today.
                  </p>
                ) : (
                  (() => {
                    const roster = model.workforce.scheduledTodayRoster;
                    const nowR = roster.filter(isWorkforceRosterNowGroup);
                    const upR = roster.filter(isWorkforceRosterUpcomingGroup);
                    const otherR = roster.filter((b) => !isWorkforceRosterNowGroup(b) && !isWorkforceRosterUpcomingGroup(b));
                    const bubble = (b: (typeof roster)[number]) => (
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
                    );
                    const bandGrid = (items: typeof roster) =>
                      items.length === 0 ? null : (
                        <div
                          className="flex min-h-0 min-w-0 w-max max-w-full flex-1 flex-nowrap items-start justify-start gap-x-0.5 gap-y-2 overflow-x-auto overflow-y-visible pb-0.5 pt-0.5"
                          style={
                            flags.avatarScale !== 1
                              ? { transform: `scale(${flags.avatarScale})`, transformOrigin: "top center" }
                              : undefined
                          }
                        >
                          {items.map(bubble)}
                        </div>
                      );
                    return (
                      <div className="mt-1.5 flex min-h-0 w-full min-w-0 flex-1 flex-col gap-y-3 overflow-x-auto overflow-y-visible sm:flex-row sm:flex-nowrap sm:items-start sm:gap-x-0 sm:gap-y-0">
                        {nowR.length > 0 ? (
                          <div className="flex min-h-0 w-max min-w-0 shrink-0 flex-col">{bandGrid(nowR)}</div>
                        ) : null}
                        {nowR.length > 0 && (upR.length > 0 || otherR.length > 0) ? (
                          <>
                            <div
                              className="mx-0.5 hidden min-h-[4rem] w-px shrink-0 self-stretch bg-[color-mix(in_srgb,var(--ds-text-primary)_14%,transparent)] dark:bg-white/12 sm:block"
                              aria-hidden
                            />
                            <div
                              className="shrink-0 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_12%,transparent)] dark:border-white/10 sm:hidden"
                              aria-hidden
                            />
                          </>
                        ) : null}
                        {upR.length > 0 ? (
                          <div className="flex min-h-0 w-max min-w-0 shrink-0 flex-col">{bandGrid(upR)}</div>
                        ) : null}
                        {upR.length > 0 && otherR.length > 0 ? (
                          <>
                            <div
                              className="mx-0.5 hidden min-h-[4rem] w-px shrink-0 self-stretch bg-[color-mix(in_srgb,var(--ds-text-primary)_14%,transparent)] dark:bg-white/12 sm:block"
                              aria-hidden
                            />
                            <div
                              className="shrink-0 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_12%,transparent)] dark:border-white/10 sm:hidden"
                              aria-hidden
                            />
                          </>
                        ) : null}
                        {otherR.length > 0 ? (
                          <div className="flex min-h-0 w-max min-w-0 shrink-0 flex-col">{bandGrid(otherR)}</div>
                        ) : null}
                      </div>
                    );
                  })()
                )}
              </div>
              ) : null}
              {flags.showSecondaryBands ? (
                <div className="mt-auto grid min-h-0 gap-3 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] pt-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
                      On schedule
                    </p>
                    {model.workforce.onScheduleToday.length === 0 ? (
                      <p className="mt-1 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">None</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {model.workforce.onScheduleToday.slice(0, 4).map((b) => (
                          <li key={b.id} className="truncate text-[11px] font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]">
                            {b.displayName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
                      Off site
                    </p>
                    {model.workforce.offSite.length === 0 ? (
                      <p className="mt-1 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">None</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {model.workforce.offSite.slice(0, 4).map((b) => (
                          <li key={b.id} className="truncate text-[11px] font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]">
                            {b.displayName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
              {flags.showCountStrip && flags.showRoster ? (
                <WorkforceCountStrip counts={model.workforce.counts} />
              ) : null}
            </div>
          </WidgetAdaptiveBody>
          );
        },
      },
      low_inventory: {
        title: "Low inventory",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/dashboard/inventory"),
        shellJumpLabel: "Open inventory",
        render: (ctx?: DashboardWidgetRenderContext) => <LowInventoryOpsWidget model={model} layoutContext={ctx} />,
      },
      co2_monitoring: {
        title: "CO₂ monitoring",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/monitoring"),
        shellJumpLabel: "Open monitoring",
        render: (ctx?: DashboardWidgetRenderContext) => <Co2MonitoringOpsWidget layoutContext={ctx} />,
      },
      pool_readings: {
        title: "Pool readings",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/monitoring"),
        shellJumpLabel: "Open monitoring",
        render: () => <PoolReadingsOpsWidget />,
      },
      facility_schedule: {
        title: "Facility schedule",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/schedule"),
        shellJumpLabel: "Open schedule",
        render: (ctx?: DashboardWidgetRenderContext) => <FacilityScheduleOpsWidget layoutContext={ctx} />,
      },
      routine_assignments: {
        title: "Routine assignments",
        accent: "none" as const,
        shellJumpHref: pulseAppHref("/standards/routines"),
        shellJumpLabel: "Open routines",
        render: (ctx?: DashboardWidgetRenderContext) => <RoutineAssignmentsOpsWidget layoutContext={ctx} />,
      },
    } as const;
  }, [model, workOrdersHref, workRequestKpiLoading]);

  const allWidgetKeys = useMemo(() => {
    return Object.keys(widgetRegistry).filter((k) => (widgetRegistry as Record<string, unknown>)[k] != null);
  }, [widgetRegistry]);

  /** Stable while the set of built-in widget ids is unchanged — avoids re-hydrating layout on every `model` tick. */
  const builtinWidgetIdsSignature = [...allWidgetKeys].sort().join("|");

  const defaultLayout = useMemo((): WorkspaceLayout => {
    if (isDeptDashboard) return { left: [], hero: [], right: [] };
    return defaultWorkspaceLayout();
  }, [isDeptDashboard]);

  const [layout, setLayout] = useState<WorkspaceLayout>(defaultLayout);

  useEffect(() => {
    let parsedConfigs: Record<string, CustomDashboardWidgetConfig> = {};
    try {
      const cw = window.localStorage.getItem(customWidgetStorageKey) ?? window.localStorage.getItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE);
      if (cw) parsedConfigs = JSON.parse(cw) as Record<string, CustomDashboardWidgetConfig>;
    } catch {
      parsedConfigs = {};
    }

    const validIds = new Set([
      ...(builtinWidgetIdsSignature.length ? builtinWidgetIdsSignature.split("|") : []),
      ...Object.keys(parsedConfigs),
    ]);

    let nextLayout: WorkspaceLayout | null = null;
    let loadedFromStorage = false;
    try {
      let raw = window.localStorage.getItem(layoutStorageKey);
      if (!raw) {
        for (const legacyKey of [
          `pulse_dashboard_layout_v10_${dashboardContext}_standard`,
          `pulse_dashboard_layout_v9_${dashboardContext}_standard`,
          `pulse_dashboard_layout_v8_${dashboardContext}_standard`,
          `pulse_dashboard_layout_v7_${dashboardContext}_standard`,
        ]) {
          raw = window.localStorage.getItem(legacyKey);
          if (raw) break;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parseWorkspaceLayout(parsed)) {
          nextLayout = parsed as WorkspaceLayout;
          loadedFromStorage = true;
        } else if (isLegacyGridLayout(parsed)) {
          nextLayout = migrateGridLayoutToWorkspace(parsed as import("react-grid-layout").LayoutItem[]);
          loadedFromStorage = true;
        }
      }
    } catch {
      nextLayout = null;
    }

    if (!loadedFromStorage || !nextLayout) nextLayout = defaultLayout;

    let merged = sanitizeWorkspaceLayout(nextLayout, validIds);
    merged = mergeMissingDefaults(merged, validIds, !loadedFromStorage);
    setLayout(merged);
    setCustomConfigs(parsedConfigs);
    setLayoutHydrated(true);
  }, [builtinWidgetIdsSignature, customWidgetStorageKey, dashboardContext, defaultLayout, layoutStorageKey]);

  const persistLayout = useCallback(
    (next: WorkspaceLayout) => {
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

  const layoutKeys = useMemo(() => new Set(allWorkspaceWidgetIds(layout)), [layout]);
  const availableToAdd = useMemo(() => allWidgetKeys.filter((k) => !layoutKeys.has(k)), [allWidgetKeys, layoutKeys]);

  const removeWidget = useCallback(
    (id: string) => {
      setLayout((prev) => {
        const next = removeWorkspaceWidget(prev, id);
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
    },
    [persistLayout],
  );

  const addWidget = useCallback(
    (id: string) => {
      if (layoutKeys.has(id)) return;
      setLayout((prev) => {
        const next = addWorkspaceWidget(prev, id);
        persistLayout(next);
        return next;
      });
    },
    [layoutKeys, persistLayout],
  );

  const saveCustomPeek = useCallback(
    (config: CustomDashboardWidgetConfig, _slot: WorkspaceWidgetSlot | null) => {
      setCustomConfigs((prev) => ({ ...prev, [config.id]: config }));
      if (_slot === null) return;
      setLayout((prev) => {
        const next = addWorkspaceWidget(prev, config.id, "left");
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  const renderWorkspaceWidget = useCallback(
    (slot: WorkspaceWidgetSlot, ctx: DashboardWidgetRenderContext): ReactNode => {
      if (slot.id.startsWith("cw_")) {
        const cfg = customConfigs[slot.id];
        if (!cfg) return null;
        return <DashboardCustomPeekWidget config={cfg} model={model} mode={ctx.mode} opsEmbedded />;
      }
      const w = (widgetRegistry as Record<string, unknown>)[slot.id] as
        | { render: (ctx?: DashboardWidgetRenderContext) => ReactNode }
        | null
        | undefined;
      return w?.render(ctx) ?? null;
    },
    [customConfigs, model, widgetRegistry],
  );

  const shellBodyClass = (widgetId: string) => {
    if (widgetId === "pool_readings") return "p-0";
    if (widgetId === "notifications_work_orders") {
      return "!overflow-hidden !p-0 flex min-h-0 flex-1 flex-col";
    }
    return undefined;
  };

  const headerShowLayoutTools = canEditLayout && !readOnly;
  const headerShowFullscreen = !isKiosk;
  const dashboardTitle =
    pathname.startsWith("/kiosk/leadership") || dashboardContext === "admin"
      ? "Leadership"
      : "Operations";

  return (
    <div
      className={cn(
        DASH.page,
        "pulse-dashboard-canvas pulse-operations-dashboard min-w-0",
        isKiosk
          ? "flex h-full min-h-0 flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-2.5 sm:px-3 sm:py-3"
          : "space-y-3",
      )}
    >
      <div
        className={cn(
          "ops-dash-header-bar flex flex-wrap items-center justify-between gap-3 px-3 py-2.5",
          isKiosk && "shrink-0",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
            {dashboardTitle}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pr-1">
            <p className="text-sm font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">
              {dateInBc(now)} · {timeInBc(now)}
            </p>
            <OpsHeaderWeather className="shrink-0" />
          </div>
        </div>
        {!isKiosk || headerShowFullscreen || headerShowLayoutTools ? (
          <div className="inline-flex max-w-full flex-wrap items-center justify-end gap-2">
            {!isKiosk ? <DashboardViewTabs variant="toolbar" className="shrink-0" /> : null}
            {!isKiosk && (headerShowFullscreen || headerShowLayoutTools) ? (
              <span className="hidden h-6 w-px shrink-0 bg-ds-border sm:block" aria-hidden />
            ) : null}
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
                {headerShowFullscreen && headerShowLayoutTools ? (
                  <span className="mx-0.5 h-6 w-px shrink-0 bg-ds-border" aria-hidden />
                ) : null}
                {headerShowLayoutTools ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (editMode) persistLayout(layout);
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
        ) : null}
      </div>

      {model.bannerNote ? (
        <div
          className={cn(
            "rounded-xl border border-ds-border bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)] px-3 py-2 text-sm font-medium text-ds-foreground",
            isKiosk && "shrink-0",
          )}
        >
          {model.bannerNote}
        </div>
      ) : null}

      {isDeptDashboard && workspaceLayoutIsEmpty(layout) && layoutHydrated && !editMode ? (
        <div className="rounded-xl border border-dashed border-ds-border bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] px-6 py-10 text-center">
          <p className="text-base font-semibold text-ds-foreground">Your dashboard is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ds-muted">
            Use the pencil to edit layout, then add widgets from the modules unlocked for your role.
          </p>
          {canEditLayout ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setEditMode(true);
                setShowAddWidget(true);
              }}
            >
              Add your first widget
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={containerRef as any}
        className={cn(
          "pulse-dashboard-grid min-w-0",
          isKiosk && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          editMode && "pulse-dashboard-edit",
          isDeptDashboard && workspaceLayoutIsEmpty(layout) && !editMode && "hidden",
        )}
      >
          {mounted ? (
            <WorkspaceDashboard
              layout={layout}
              containerWidth={width}
              editMode={editMode && canEditLayout}
              onLayoutChange={(next) => {
                setLayout(next);
                persistLayout(next);
              }}
              renderSlot={(slot, _column, ctx) => {
                const zone = widgetZoneClass(slot.id);
                const title =
                  slot.id.startsWith("cw_")
                    ? (customConfigs[slot.id]?.title ?? "Widget")
                    : ((widgetRegistry as Record<string, { title: string }>)[slot.id]?.title ?? slot.id);

                const headerRight =
                  !readOnly && editMode ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => removeWidget(slot.id)}
                      className="h-5 min-w-5 px-0 text-[11px] leading-none"
                      aria-label={`Remove ${title}`}
                    >
                      ×
                    </Button>
                  ) : slot.id.startsWith("cw_") && !readOnly ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const cfg = customConfigs[slot.id];
                        if (!cfg) return;
                        setPeekWizardInitial(cfg);
                        setPeekWizardMode("edit");
                        setShowPeekWizard(true);
                      }}
                      className="inline-flex h-5 items-center px-1.5 py-0"
                      aria-label="Edit peek widget"
                    >
                      <Settings className="h-3 w-3" aria-hidden />
                    </Button>
                  ) : null;

                const registryEntry = (widgetRegistry as Record<string, { shellJumpHref?: string; shellJumpLabel?: string }>)[slot.id];
                const peekPage = slot.id.startsWith("cw_") ? catalogPage(customConfigs[slot.id]?.pageId ?? "") : null;

                return (
                  <div
                    data-guided-tour-anchor={
                      slot.id === "notifications_work_orders"
                        ? "dashboard-alerts"
                        : slot.id === "workforce"
                          ? "dashboard-workforce"
                          : slot.id === "low_inventory"
                            ? "dashboard-inventory"
                            : undefined
                    }
                    className="flex h-full min-h-0 flex-col"
                  >
                    <OpsWidgetShell
                      title={title}
                      archetype={zone === "hero" ? "elastic" : "kpi"}
                      chrome={slot.id === "pool_readings" ? "minimal" : "standard"}
                      jumpHref={
                        slot.id.startsWith("cw_")
                          ? pulseAppHref(peekPage?.href ?? "/overview")
                          : registryEntry?.shellJumpHref
                      }
                      jumpLabel={
                        slot.id.startsWith("cw_")
                          ? peekPage
                            ? `Open ${peekPage.label}`
                            : "Open page"
                          : registryEntry?.shellJumpLabel
                      }
                      headerRight={headerRight}
                      className="h-full"
                      bodyClassName={shellBodyClass(slot.id)}
                    >
                      {renderWorkspaceWidget(slot, ctx)}
                    </OpsWidgetShell>
                  </div>
                );
              }}
            />
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
                    {isDeptDashboard
                      ? "Build a compact peek from a module you have unlocked (pick slices and options)."
                      : 'Re-enable a built-in card, or build a compact "peek" from another Pulse page (pick slices and options).'}
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
                {!isDeptDashboard ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </Card>
          </div>
        ) : null}

      {!readOnly ? (
        <DashboardAddWidgetWizard
          open={showPeekWizard}
          mode={peekWizardMode}
          initialConfig={peekWizardInitial}
          session={session ?? null}
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
  /** Storage namespace for layout/widgets (`operations`, `admin`, or `dept_{slug}`). */
  dashboardContext?: string;
}) {
  const { session } = usePulseAuth();
  const [liveModel, setLiveModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(variant === "live");
  const [error, setError] = useState<string | null>(null);
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
        useOperationalNotificationsStore.getState().clear();
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
        useOperationalNotificationsStore.getState().clear();
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

      let wrKpi: DashboardViewModel["workRequests"]["kpi"] = null;
      const canWrKpi =
        auth &&
        isUserFeatureEnabled(auth, "work_requests") &&
        (hasRbacPermission(auth, "work_requests.view") ||
          hasRbacPermission(auth, "work_requests.edit"));
      if (canWrKpi) {
        const companyId =
          auth.is_system_admin && auth.company_id ? String(auth.company_id) : null;
        try {
          wrKpi = await fetchWorkRequestKpiSummary({ companyId });
        } catch {
          wrKpi = null;
        }
      }

      const withWelcome: DashboardViewModel = {
        ...model,
        welcomeName: welcome,
        bannerNote: null,
        workRequests: { ...model.workRequests, kpi: wrKpi },
      };
      readyPayload = notificationCountsFromAlerts(withWelcome.alerts);
      setLiveModel(withWelcome);
      useOperationalNotificationsStore.getState().setItems(withWelcome.alerts);
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
      useOperationalNotificationsStore.getState().clear();
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
      notifyReady(notificationCountsFromAlerts(demoModel().alerts));
    }
  }, [variant, notifyReady]);

  const attendanceMarks = useWorkerDayAttendanceStore((s) => s.marks);
  const mergedDemoModel = useMemo(() => {
    const welcome = welcomeFromSession(session?.email, session?.full_name);
    return mergeAttendanceIntoDashboardModel({ ...demoModel(), welcomeName: welcome }, attendanceMarks);
  }, [session?.email, session?.full_name, attendanceMarks]);

  useEffect(() => {
    if (variant !== "demo") return;
    useOperationalNotificationsStore.getState().setItems(mergedDemoModel.alerts);
  }, [variant, mergedDemoModel]);

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
      readOnly={readOnly}
      workRequestKpiLoading={loading}
    />
  );
}
