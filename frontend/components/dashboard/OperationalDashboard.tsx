"use client";

import { AlertTriangle, Battery, Info, MapPin, Package, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GridLayout, noCompactor, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AdminOnboardingChecklist } from "@/components/onboarding/AdminOnboardingChecklist";
import { apiFetch, isApiMode } from "@/lib/api";
import { fetchOnboarding, fetchSetupProgress } from "@/lib/onboardingService";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { getServerDate, getServerNow } from "@/lib/serverTime";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type AlertItem = { severity: "critical" | "warning"; title: string; subtitle?: string };

/** Passed to `OperationalDashboard` `onReady` for welcome modal / other consumers. */
export type OperationalDashboardReadyPayload = {
  criticalCount: number;
  warningCount: number;
};

function alertCountsFromAlerts(alerts: AlertItem[]): OperationalDashboardReadyPayload {
  const real = alerts.filter((a) => a.title !== "No active alerts");
  return {
    criticalCount: real.filter((a) => a.severity === "critical").length,
    warningCount: real.filter((a) => a.severity === "warning").length,
  };
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

type DashboardViewModel = {
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
    offSite: WorkforceBubble[];
    counts: { onSite: number; onShiftNow: number; upcomingToday: number; offSite: number };
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
      ? "bg-emerald-500"
      : color === "yellow"
        ? "bg-amber-400"
        : "bg-slate-400";
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 z-10 h-2.5 w-2.5 rounded-full ${bg} ring-2 ring-[var(--ds-surface-primary)]`}
      aria-hidden
    />
  );
}

function WorkforceUpcomingPill() {
  return (
    <span className="absolute -bottom-1 -right-1 z-10 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-800 ring-2 ring-[var(--ds-surface-primary)] dark:bg-blue-600 dark:text-white">
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
        title: "Missing Hammer Drill",
        subtitle: "Last seen: Boiler Room\nZone 3 (Garage)",
      },
      {
        severity: "warning",
        title: "Zone 3 (Garage) Offline",
        subtitle: "Status: Planned",
      },
      {
        severity: "warning",
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
      counts: { onSite: 1, onShiftNow: 1, upcomingToday: 1, offSite: 1 },
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
  avatar_url?: string | null;
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
};

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
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const shiftsToday = shifts.filter((s) => {
    const a = new Date(s.starts_at).getTime();
    const b = new Date(s.ends_at).getTime();
    return a < dayEnd.getTime() && b > dayStart.getTime();
  });

  const rosterWorkers = workers.filter((w) =>
    ["worker", "manager", "company_admin", "supervisor", "lead"].includes(w.role),
  );

  const shiftByWorker = new Map<string, ShiftOut[]>();
  for (const s of shiftsToday) {
    if (!shiftByWorker.has(s.assigned_user_id)) shiftByWorker.set(s.assigned_user_id, []);
    shiftByWorker.get(s.assigned_user_id)!.push(s);
  }

  const scheduledWorkers = rosterWorkers.filter((w) => (shiftByWorker.get(w.id)?.length ?? 0) > 0);

  const bubbles: WorkforceBubble[] = scheduledWorkers.map((w) => {
    const initials = initialsFromUser(w.email, w.full_name);
    const mine = shiftByWorker.get(w.id) ?? [];
    const active = mine.some((s) => {
      const a = new Date(s.starts_at).getTime();
      const b = new Date(s.ends_at).getTime();
      return a <= now && now < b;
    });
    const nextStart =
      mine.length === 0
        ? null
        : Math.min(
            ...mine.map((s) => {
              return new Date(s.starts_at).getTime();
            }),
          );

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

    const isUpcomingToday = nextStart != null && now < nextStart && nextStart < dayEnd.getTime();

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

  const scheduledCount = new Set(shiftsToday.map((s) => s.assigned_user_id)).size;

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
      title: `Missing · ${t.name}`,
      subtitle: `Last known zone: ${zoneName(t.zone_id)}`,
    });
  }
  for (const t of oos.slice(0, 2)) {
    alerts.push({
      severity: "warning",
      title: `Out of service · ${t.name}`,
      subtitle: `Zone: ${zoneName(t.zone_id)}`,
    });
  }
  for (const row of lowStock.slice(0, 3)) {
    alerts.push({
      severity: "warning",
      title: `Low stock · ${row.name}`,
      subtitle: `Qty ${row.quantity} at or below threshold (${row.low_stock_threshold} ${"units"})`,
    });
  }
  for (const msg of dashboard.alerts) {
    if (alerts.length >= 8) break;
    alerts.push({ severity: "warning", title: msg });
  }
  if (alerts.length === 0) {
    alerts.push({
      severity: "warning",
      title: "No active alerts",
      subtitle: "Operations look clear. New exceptions will surface here.",
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
      offSite,
      counts: {
        onSite: onSite.length,
        onShiftNow: onShiftNow.length,
        upcomingToday: upcomingToday.length,
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

/** Dusk blue brand stroke (matches `--ds-bg` dark / design token). */
const OPS_HEADER_LOGO_RING = "#4C6085";

const ADMIN_SETUP_BANNER_DISMISS_KEY = "pulse_admin_setup_banner_dismissed";

function OperationsHeaderLogoMark({
  logoUrl,
  companyName,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
}) {
  const raw = logoUrl?.trim() || null;
  const internal = raw && !raw.startsWith("http://") && !raw.startsWith("https://") ? raw : null;
  const resolved = useAuthenticatedAssetSrc(internal);
  const src =
    !raw ? null : raw.startsWith("http://") || raw.startsWith("https://") ? raw : resolved;
  const waiting = Boolean(internal && !src);
  const initials = headerInitials(companyName ?? "");

  return (
    <div
      className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white shadow-[var(--ds-shadow-card)]"
      style={{ borderColor: OPS_HEADER_LOGO_RING }}
      title={(companyName?.trim() || "Company").slice(0, 48)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob or tenant https URL
        <img src={src} alt="" className="max-h-[2.75rem] max-w-[2.75rem] object-contain" />
      ) : waiting ? (
        <span className="h-8 w-8 animate-pulse rounded-md bg-ds-secondary" aria-hidden />
      ) : (
        <span className="px-1 text-center text-xs font-bold leading-tight" style={{ color: OPS_HEADER_LOGO_RING }}>
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
}) {
  const userInitials = headerInitials(model.welcomeName);
  const [editMode, setEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const storageKey = "dashboard_layout_v1";

  const widgetRegistry = useMemo(() => {
    return {
      alerts: {
        title: "Active Alerts",
        accent: "yellow" as const,
        render: () => (
          <ul className="flex flex-1 flex-col gap-3">
            {model.alerts.map((a, idx) => (
              <li
                key={`${a.title}-${idx}`}
                className={`ds-notification flex gap-3 p-4 ${
                  a.severity === "critical" ? "ds-notification-critical" : "ds-notification-warning"
                }`}
              >
                {a.severity === "critical" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" aria-hidden />
                ) : (
                  <Radio className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ds-foreground">{a.title}</p>
                  {a.subtitle ? (
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ds-muted">
                      {a.subtitle}
                    </p>
                  ) : null}
                </div>
              </li>
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
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
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
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
              <span className="app-badge-amber inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-tight">
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
              <span className="app-badge-amber inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
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
                  model.inventory.consumablesOk ? "app-badge-emerald" : "app-badge-amber"
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
                  <span className="app-badge-amber shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
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
      setup: facilitySetupChecklist
        ? {
            title: "Setup checklist",
            accent: "none" as const,
            render: () => facilitySetupChecklist,
          }
        : null,
    } as const;
  }, [facilitySetupChecklist, model, onDismissZonePrompt, pulseTenantNav, workOrdersHref, zonePromptDismissed]);

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
    ];
    return widgetRegistry.setup
      ? ([{ i: "setup", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 }, ...base] as const)
      : base;
  }, [widgetRegistry.setup]);

  const [layout, setLayout] = useState<Layout>(defaultLayout);

  // Load saved layout once per "shape" (e.g. when setup widget appears/disappears).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setLayout(defaultLayout);
        return;
      }
      const parsed = JSON.parse(raw) as Layout;
      if (!Array.isArray(parsed)) {
        setLayout(defaultLayout);
        return;
      }
      const validKeys = new Set(allWidgetKeys);
      const filtered = parsed.filter((l) => l && typeof l.i === "string" && validKeys.has(l.i));
      const present = new Set(filtered.map((l) => l.i));
      const missing = defaultLayout.filter((l) => !present.has(l.i));
      setLayout([...filtered, ...missing]);
    } catch {
      setLayout(defaultLayout);
    }
  }, [allWidgetKeys, defaultLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [layout]);

  const layoutKeys = useMemo(() => new Set(layout.map((l) => l.i)), [layout]);
  const availableToAdd = useMemo(() => allWidgetKeys.filter((k) => !layoutKeys.has(k)), [allWidgetKeys, layoutKeys]);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => prev.filter((l) => l.i !== id));
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

  return (
    <div className="ds-dashboard-shell">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-ds-border bg-ds-primary px-4 py-4 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-ds-foreground sm:text-lg md:text-xl lg:text-2xl">
          {model.title}
        </span>
        <div className="flex min-h-0 min-w-0 justify-center">
          <OperationsHeaderLogoMark logoUrl={headerLogoUrl} companyName={headerCompanyName} />
        </div>
        {!hideHeaderWelcome ? (
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <p className="min-w-0 truncate text-xs text-ds-muted sm:text-sm">
              Welcome,{" "}
              <span className="font-semibold text-ds-foreground">{model.welcomeName}</span>
            </p>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ds-success text-xs font-bold text-ds-on-accent ring-2 ring-ds-border">
              {userInitials.slice(0, 2)}
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ds-success text-[9px] font-bold leading-none text-ds-on-accent shadow-[var(--ds-shadow-card)] ring-2 ring-[var(--ds-surface-primary)]"
                aria-hidden
              >
                M
              </span>
            </span>
          </div>
        ) : (
          <div className="min-w-0" aria-hidden />
        )}
      </header>

      {model.bannerNote ? (
        <div className="ds-notification ds-notification-warning flex flex-wrap items-center justify-center gap-2 border-x-0 border-t-0 rounded-none px-4 py-3 text-sm font-medium text-ds-foreground">
          <Info className="h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
          <span>
            {model.bannerNote}{" "}
            <Link href="/monitoring" className="ds-link">
              Open Monitoring →
            </Link>
          </span>
        </div>
      ) : null}

      <div className="p-5 lg:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className={editMode ? "ds-btn-solid-primary px-4 py-2 text-sm" : "ds-btn-secondary px-4 py-2 text-sm"}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Done Editing" : "Edit Dashboard"}
          </button>
          {editMode ? (
            <button
              type="button"
              className="ds-btn-secondary px-4 py-2 text-sm"
              onClick={() => setShowAddWidget(true)}
              disabled={availableToAdd.length === 0}
              title={availableToAdd.length === 0 ? "All widgets are already added" : "Add a widget"}
            >
              Add Widget
            </button>
          ) : null}
        </div>

        <div ref={containerRef as any}>
          {mounted ? (
            <GridLayout
              layout={layout}
              width={width}
              gridConfig={{ cols: 12, rowHeight: 100, margin: [24, 24], containerPadding: [0, 0] }}
              dragConfig={{ enabled: editMode, bounded: false, handle: ".dashboard-drag-handle" }}
              resizeConfig={{ enabled: editMode, handles: ["se"] }}
              compactor={noCompactor}
              onLayoutChange={(next) => setLayout(next)}
            >
          {layout.map((item) => {
            const w = (widgetRegistry as Record<string, any>)[item.i] as
              | { title: string; accent: "yellow" | "red" | "blue" | "green" | "none"; render: () => ReactNode }
              | null
              | undefined;
            if (!w) return <div key={item.i} />;
            const headerRight = (
              <div className="flex items-center gap-2">
                {editMode ? (
                  <span className="dashboard-drag-handle select-none rounded-md border border-black/10 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-sm dark:bg-white/85 dark:text-slate-900">
                    Drag
                  </span>
                ) : null}
                {editMode ? (
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
                className={[
                  "transition-transform",
                  editMode ? "cursor-grab active:cursor-grabbing" : "",
                ].join(" ")}
              >
                <DashboardCard
                  title={w.title}
                  accent={w.accent}
                  headerRight={headerRight}
                  className="h-full"
                  bodyClassName={item.i === "setup" ? "overflow-auto" : undefined}
                >
                  {w.render()}
                </DashboardCard>
              </div>
            );
          })}
            </GridLayout>
          ) : null}
        </div>

        {showAddWidget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="ds-modal-backdrop absolute inset-0" onClick={() => setShowAddWidget(false)} aria-hidden />
            <div className="relative w-full max-w-md rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Add Widget</p>
                  <p className="mt-1 text-sm text-slate-600">Choose a widget to add back to your dashboard.</p>
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
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-slate-600">All widgets are already added.</p>
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
      </div>
    </div>
  );
}

export type OperationalDashboardVariant = "demo" | "live";

export function OperationalDashboard({
  variant,
  onReady,
}: {
  variant: OperationalDashboardVariant;
  /** Fires once when the dashboard has finished its initial load (live fetch done or demo mounted). */
  onReady?: (payload?: OperationalDashboardReadyPayload) => void;
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

  const fetchLive = useCallback(async () => {
    const sess = readSession();
    if (!canAccessPulseTenantApis(sess)) {
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
    // Align "today" with the schedule module: use local day bounds, not UTC midnight.
    // This avoids excluding shifts for tenants in non-UTC timezones.
    const now = new Date(getServerNow());
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const from = start.toISOString();
    const to = end.toISOString();

    try {
      const [dash, wrList, workers, assetList, lowStock, zoneList, beaconList, setupProgress] = await Promise.all([
        apiFetch<DashboardPayload>("/api/v1/pulse/dashboard"),
        apiFetch<WorkRequestListOut>("/api/v1/pulse/work-requests?limit=40&offset=0"),
        apiFetch<WorkerOut[]>("/api/v1/pulse/workers"),
        apiFetch<AssetOut[]>("/api/v1/pulse/assets"),
        apiFetch<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
        apiFetch<ZoneOut[]>("/api/v1/pulse/zones"),
        apiFetch<BeaconEquipmentOut[]>("/api/v1/pulse/equipment"),
        fetchSetupProgress().catch(() => null),
      ]);
      let shiftList: ShiftOut[] = [];
      try {
        shiftList = await apiFetch<ShiftOut[]>(
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
      const bannerNote =
        setupProgress?.onboarding_demo_sensors === true
          ? "Demo monitoring data is active for your organization."
          : null;
      const withWelcome: DashboardViewModel = { ...model, welcomeName: welcome, bannerNote };
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
  }, [variant, notifyReady]);

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
      <DashboardBody model={demoModel()} workOrdersHref={workOrdersHref} facilitySetupChecklist={null} />
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
      headerLogoUrl={session?.company?.logo_url ?? null}
      headerCompanyName={session?.company?.name ?? null}
      facilitySetupChecklist={facilitySetupSlot}
    />
  );
}
