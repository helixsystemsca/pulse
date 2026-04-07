"use client";

import { AlertTriangle, Battery, MapPin, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FacilitySetupChecklist } from "@/components/onboarding/FacilitySetupChecklist";
import { apiFetch, isApiMode } from "@/lib/api";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { getServerDate, getServerNow } from "@/lib/serverTime";

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
  title: string;
  kind: "onsite" | "offsite" | "absent";
  badge?: "L" | "S";
};

type WorkTag = { kind: "progress" | "overdue" | "urgent"; label: string };

type DashboardViewModel = {
  title: string;
  welcomeName: string;
  alerts: AlertItem[];
  workforce: {
    dateLabel: string;
    summaryLine: string;
    onsite: WorkforceBubble[];
    offsite: WorkforceBubble[];
    absent: WorkforceBubble[];
    counts: { onsite: number; offsite: number; absent: number };
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
  "pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-[#111827]";

function onsiteAvatarClass(badge?: "L" | "S") {
  const isLead = badge === "L";
  const shared =
    "relative shrink-0 items-center justify-center rounded-full bg-emerald-100/85 dark:bg-emerald-500/12 font-bold text-emerald-700 dark:text-emerald-400 shadow-md ring-1 ring-emerald-300 dark:ring-emerald-500/35 ring-offset-2 ring-offset-white/70 dark:ring-offset-slate-900/50 transition-transform";
  if (isLead) {
    return `z-[1] flex h-14 w-14 text-base shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-2 ring-emerald-400 dark:ring-emerald-500/45 md:h-16 md:w-16 md:text-lg ${shared}`;
  }
  return `flex h-11 w-11 text-xs shadow-sm md:h-12 md:w-12 md:text-sm ${shared}`;
}

function offsiteAvatarClass() {
  return "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100/80 dark:bg-amber-500/12 text-xs font-bold text-amber-700 dark:text-amber-400 shadow-sm ring-1 ring-amber-300 dark:ring-amber-500/35 ring-offset-2 ring-offset-white/70 dark:ring-offset-slate-900/50 md:h-12 md:w-12 md:text-sm";
}

function absentAvatarClass() {
  return "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100/85 dark:bg-red-500/12 text-xs font-bold text-red-700 dark:text-red-400 opacity-[0.92] shadow-sm ring-1 ring-red-300 dark:ring-red-500/40 ring-offset-2 ring-offset-white/70 dark:ring-offset-slate-900/50 after:absolute after:bottom-0 after:right-0 after:z-10 after:h-2.5 after:w-2.5 after:rounded-full after:bg-red-600 dark:bg-red-500 after:ring-2 after:ring-white dark:ring-[#111827] md:h-11 md:w-11 md:text-sm";
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
      summaryLine: "9 Scheduled · 1 Lead · 1 Supervisor · 6 On-site · 2 Off-site · 1 Sick",
      onsite: [
        { id: "1", initials: "MR", title: "Site lead · On-site", kind: "onsite", badge: "L" },
        { id: "2", initials: "AR", title: "Supervisor · On-site", kind: "onsite", badge: "S" },
        { id: "3", initials: "JA", title: "Technician · On-site", kind: "onsite" },
        { id: "4", initials: "LS", title: "Technician · On-site", kind: "onsite" },
        { id: "5", initials: "NT", title: "Technician · On-site", kind: "onsite" },
        { id: "6", initials: "KP", title: "Technician · On-site", kind: "onsite" },
      ],
      offsite: [
        { id: "7", initials: "RW", title: "Technician · Off-site (Site B)", kind: "offsite" },
        { id: "8", initials: "EB", title: "Technician · Off-site (vendor call)", kind: "offsite" },
      ],
      absent: [{ id: "9", initials: "DM", title: "Absent · Sick (unavailable)", kind: "absent" }],
      counts: { onsite: 6, offsite: 2, absent: 1 },
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
    ["worker", "manager", "company_admin"].includes(w.role),
  );

  const bubbles: WorkforceBubble[] = rosterWorkers.map((w) => {
    const initials = initialsFromUser(w.email, w.full_name);
    const mine = shiftsToday.filter((s) => s.assigned_user_id === w.id);
    const active = mine.some((s) => {
      const a = new Date(s.starts_at).getTime();
      const b = new Date(s.ends_at).getTime();
      return a <= now && now < b;
    });
    const scheduledToday = mine.length > 0;
    let kind: WorkforceBubble["kind"] = "offsite";
    let title = `${w.full_name ?? w.email} · Unscheduled today`;
    if (active) {
      kind = "onsite";
      title = `${w.full_name ?? w.email} · On shift now`;
    } else if (scheduledToday) {
      kind = "offsite";
      title = `${w.full_name ?? w.email} · Scheduled (off shift)`;
    }
    let badge: WorkforceBubble["badge"];
    if (kind === "onsite") {
      if (w.role === "company_admin") badge = "L";
      else if (w.role === "manager") badge = "S";
    }
    return { id: w.id, initials, title, kind, badge };
  });

  const onsite = bubbles.filter((b) => b.kind === "onsite");
  const offsite = bubbles.filter((b) => b.kind === "offsite");
  const absent: WorkforceBubble[] = [];
  const scheduledCount = new Set(shiftsToday.map((s) => s.assigned_user_id)).size;

  const summaryLine = `${scheduledCount} scheduled · ${onsite.length} on-site · ${offsite.length} off-site`;

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
    alerts,
    workforce: {
      dateLabel: getServerDate().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      summaryLine,
      onsite,
      offsite,
      absent,
      counts: { onsite: onsite.length, offsite: offsite.length, absent: absent.length },
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

function DashboardBody({
  model,
  workOrdersHref,
  hideHeaderWelcome,
  zonePromptDismissed,
  onDismissZonePrompt,
  headerImageUrl,
  facilitySetupChecklist,
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
  hideHeaderWelcome?: boolean;
  zonePromptDismissed?: boolean;
  onDismissZonePrompt?: () => void;
  /** Tenant banner for Operations header only; omit or null when unset — no placeholder. */
  headerImageUrl?: string | null;
  facilitySetupChecklist?: ReactNode;
}) {
  const userInitials = headerInitials(model.welcomeName);
  const trimmedHeaderImage = headerImageUrl?.trim() || null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-700/45 dark:bg-slate-900/20">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200/80 bg-white/60 px-4 py-4 dark:border-slate-700/45 dark:bg-slate-900/35 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-lg md:text-xl lg:text-2xl">
          {model.title}
        </span>
        <div className="flex min-h-0 min-w-0 justify-center">
          {trimmedHeaderImage ? (
            <img
              src={trimmedHeaderImage}
              alt=""
              className="max-h-12 max-w-[min(100%,280px)] object-contain object-center sm:max-h-14"
            />
          ) : null}
        </div>
        {!hideHeaderWelcome ? (
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <p className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              Welcome,{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{model.welcomeName}</span>
            </p>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400 ring-2 ring-gray-200 dark:ring-[#1F2937]">
              {userInitials.slice(0, 2)}
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-600 dark:bg-[#3B82F6] text-[9px] font-bold leading-none text-white shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-2 ring-white dark:ring-[#111827]"
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

      <div className="grid gap-5 p-5 lg:grid-cols-12 lg:gap-6 lg:p-6">
        {facilitySetupChecklist}
        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-12 lg:p-6"
          data-dashboard-tile="alerts"
        >
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Active Alerts</h3>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
            {model.alerts.map((a, idx) => (
              <li
                key={`${a.title}-${idx}`}
                className={`flex gap-3 rounded-xl border border-gray-200 p-4 dark:border-[#1F2937] ${
                  a.severity === "critical"
                    ? "border-l-2 border-l-red-500 bg-red-100/60 dark:border-l-red-400 dark:bg-red-950/50 dark:ring-1 dark:ring-red-500/25"
                    : "border-l-2 border-l-amber-500 bg-amber-100/60 dark:border-l-amber-400 dark:bg-amber-950/55 dark:ring-1 dark:ring-amber-500/25"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-1 shrink-0 rounded-full ${
                    a.severity === "critical" ? "bg-red-500 dark:bg-red-500/90" : "bg-amber-500 dark:bg-amber-400/90"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold text-gray-900 ${
                      a.severity === "critical" ? "dark:text-red-50" : "dark:text-amber-50"
                    }`}
                  >
                    {a.title}
                  </p>
                  {a.subtitle ? (
                    <p
                      className={`mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-500 ${
                        a.severity === "critical" ? "dark:text-red-100/90" : "dark:text-amber-100/85"
                      }`}
                    >
                      {a.subtitle}
                    </p>
                  ) : null}
                </div>
                {a.severity === "critical" ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-700 dark:text-red-200" aria-hidden />
                ) : (
                  <Radio className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-5 lg:min-h-[280px] lg:p-6"
          data-dashboard-tile="workforce"
        >
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Workforce</h3>
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Today – {model.workforce.dateLabel}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{model.workforce.summaryLine}</p>

          <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  On-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onsite.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No one on shift right now.</p>
                  ) : (
                    model.workforce.onsite.map((b) => (
                      <span
                        key={b.id}
                        title={b.title}
                        className={onsiteAvatarClass(b.badge)}
                      >
                        {b.initials}
                        {b.badge === "L" ? (
                          <span className={`${roleBadgeBase} bg-emerald-700`}>L</span>
                        ) : null}
                        {b.badge === "S" ? (
                          <span className={`${roleBadgeBase} bg-blue-600 dark:bg-[#3B82F6]`}>S</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Off-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.offsite.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
                  ) : (
                    model.workforce.offsite.map((b) => (
                      <span key={b.id} title={b.title} className={offsiteAvatarClass()}>
                        {b.initials}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-200 dark:border-[#1F2937] pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">Absent</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {model.workforce.absent.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
                ) : (
                  model.workforce.absent.map((b) => (
                    <span key={b.id} title={b.title} className={absentAvatarClass()}>
                      {b.initials}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 dark:border-[#1F2937] pt-4">
            <span className="app-badge-emerald inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
              On-site · {model.workforce.counts.onsite}
            </span>
            <span className="app-badge-amber inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
              Off-site · {model.workforce.counts.offsite}
            </span>
            <span className="app-badge-red inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
              Absent · {model.workforce.counts.absent}
            </span>
          </div>
        </section>

        <section
          className="app-dashboard-tile p-5 lg:col-span-7 lg:p-6"
          data-dashboard-tile="work-requests"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Work Requests</h3>
            <span className="app-badge-amber inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-tight">
              {model.workRequests.awaitingCount} requests awaiting assignment
            </span>
          </div>
          <p className="mt-2 text-xs">
            <Link
              href={workOrdersHref}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
            >
              Open work orders view →
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {model.workRequests.newest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Newest
                </p>
                <div className="app-glass-inset-dense mt-2 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{model.workRequests.newest.title}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{model.workRequests.newest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.newest.tag} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No open work requests in the live feed.</p>
            )}

            {model.workRequests.oldest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Oldest</p>
                <div className="app-glass-inset-dense mt-2 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{model.workRequests.oldest.title}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{model.workRequests.oldest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.oldest.tag} />
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                High priority / Critical
              </p>
              {model.workRequests.critical.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No high-priority items right now.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-3">
                  {model.workRequests.critical.map((row) => (
                    <li
                      key={row.title}
                      className="flex gap-3 rounded-xl border border-gray-200 dark:border-[#1F2937] border-l-2 border-l-red-500 dark:border-l-red-400 bg-red-100/60 dark:bg-red-500/10 p-3"
                    >
                      <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-red-500 dark:bg-red-500/90" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{row.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{row.subtitle}</p>
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
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-6"
          data-dashboard-tile="equipment"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Equipment Update</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100 md:text-3xl">
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
          <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-gray-200 dark:border-[#1F2937] pt-4">
            {model.equipment.showZonePrompt && !zonePromptDismissed ? (
              <div className="rounded-xl border border-gray-200 dark:border-[#1F2937] border-l-2 border-l-amber-500 dark:border-l-amber-400 bg-amber-100/60 dark:bg-amber-500/10 p-4 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/90 dark:bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
                      Several tools are accounted for, but may need zone checks.
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Schedule a cleanup?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        className="inline-flex rounded-lg bg-blue-600 dark:bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-[filter] hover:brightness-110"
                      >
                        Review inventory
                      </Link>
                      <button
                        type="button"
                        onClick={onDismissZonePrompt}
                        className="app-glass-inset-dense rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-white/60 dark:text-gray-100 dark:hover:bg-white/10"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {model.equipment.showBatteryNote ? (
              <div className="app-glass-inset-dense rounded-xl p-4 text-gray-500 dark:text-gray-400">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-gray-500 ring-1 ring-white/30 backdrop-blur-sm dark:bg-slate-900/65 dark:text-gray-400 dark:ring-white/10">
                    <Battery className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                    Beacon equipment registered — confirm batteries and swaps on the floor before the next shift.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-6"
          data-dashboard-tile="inventory"
        >
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Inventory Status</h3>
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="app-glass-inset-dense flex items-start justify-between gap-4 rounded-xl p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Consumables</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {model.inventory.consumablesOk
                    ? "Stock within target range"
                    : "One or more items need attention"}
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
              <div className="app-surface-inset rounded-xl p-4 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Inventory Alert
                </p>
                <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-gray-200 dark:border-[#1F2937] border-l-2 border-l-amber-500 dark:border-l-amber-400 bg-amber-100/60 dark:bg-amber-500/10 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{model.inventory.alert.category}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-500" />
                      {model.inventory.alert.message}
                    </p>
                  </div>
                      <span className="app-badge-amber shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    Soon
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="app-glass-inset-dense rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-white/60 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    View stock
                  </Link>
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="rounded-lg bg-blue-600 dark:bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-[filter] hover:brightness-110"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No low-stock alerts.</p>
            )}

            <div className="border-t border-gray-200 dark:border-[#1F2937] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Shopping List
              </p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Add items from low-stock alerts.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {model.inventory.shoppingList.map((item) => (
                    <li
                      key={item}
                      className="app-glass-inset-dense flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-white/55 dark:text-gray-100 dark:hover:bg-white/10"
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 rounded border border-white/25 bg-white/80 dark:border-white/15 dark:bg-slate-900/50"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
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

  const workOrdersHref =
    pulseTenantNav.find((n) => n.href === "/dashboard/maintenance/work-orders")?.href ??
    "/dashboard/maintenance/work-orders";

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
    const now = new Date(getServerNow());
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const from = start.toISOString();
    const to = end.toISOString();

    try {
      const [dash, wrList, workers, assetList, lowStock, zoneList, beaconList] = await Promise.all([
        apiFetch<DashboardPayload>("/api/v1/pulse/dashboard"),
        apiFetch<WorkRequestListOut>("/api/v1/pulse/work-requests?limit=40&offset=0"),
        apiFetch<WorkerOut[]>("/api/v1/pulse/workers"),
        apiFetch<AssetOut[]>("/api/v1/pulse/assets"),
        apiFetch<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
        apiFetch<ZoneOut[]>("/api/v1/pulse/zones"),
        apiFetch<BeaconEquipmentOut[]>("/api/v1/pulse/equipment"),
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
      const withWelcome: DashboardViewModel = { ...model, welcomeName: welcome };
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

  const facilitySetupSlot =
    variant === "live" && session && canAccessPulseTenantApis(session) ? <FacilitySetupChecklist /> : null;

  if (variant === "demo") {
    return (
      <DashboardBody model={demoModel()} workOrdersHref={workOrdersHref} facilitySetupChecklist={null} />
    );
  }

  if (loading) {
    return (
      <div className="app-dashboard-tile rounded-2xl p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading live dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-[#1F2937] border-l-2 border-l-amber-500 dark:border-l-amber-400 bg-amber-100/60 dark:bg-amber-500/10 p-6 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void fetchLive()}
          className="mt-4 rounded-xl bg-blue-600 dark:bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!liveModel) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No dashboard data available.</p>
    );
  }

  const liveHeaderImage =
    session?.company?.header_image_url?.trim() || null;

  return (
    <DashboardBody
      model={liveModel}
      workOrdersHref={workOrdersHref}
      hideHeaderWelcome
      zonePromptDismissed={zoneDismissed}
      onDismissZonePrompt={() => setZoneDismissed(true)}
      headerImageUrl={liveHeaderImage}
      facilitySetupChecklist={facilitySetupSlot}
    />
  );
}
