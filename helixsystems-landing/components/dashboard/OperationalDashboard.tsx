"use client";

import { AlertTriangle, Battery, MapPin, Radio } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import { pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";

type AlertItem = { severity: "critical" | "warning"; title: string; subtitle?: string };

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
  "pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white";

function onsiteAvatarClass(badge?: "L" | "S") {
  const isLead = badge === "L";
  const shared =
    "relative shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900 shadow-md ring-2 ring-emerald-500/55 ring-offset-2 ring-offset-white transition-transform";
  if (isLead) {
    return `z-[1] flex h-14 w-14 text-base shadow-lg ring-[3px] ring-emerald-600 md:h-16 md:w-16 md:text-lg ${shared}`;
  }
  return `flex h-11 w-11 text-xs shadow-sm md:h-12 md:w-12 md:text-sm ${shared}`;
}

function offsiteAvatarClass() {
  return "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-950 shadow-sm ring-2 ring-amber-500/45 ring-offset-2 ring-offset-white md:h-12 md:w-12 md:text-sm";
}

function absentAvatarClass() {
  return "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-800 opacity-[0.88] shadow-sm ring-2 ring-red-400/65 ring-offset-2 ring-offset-white after:absolute after:bottom-0 after:right-0 after:z-10 after:h-2.5 after:w-2.5 after:rounded-full after:bg-red-500 after:ring-2 after:ring-white md:h-11 md:w-11 md:text-sm";
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
    title: "Panorama Dashboard",
    welcomeName: "Liz Gregg",
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
      dateLabel: new Date().toLocaleDateString("en-US", {
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
  if (due != null && due < Date.now()) return { kind: "overdue", label: "Overdue" };
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

  const now = Date.now();
  const dayStart = new Date();
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

  const brand =
    process.env.NEXT_PUBLIC_PULSE_DASHBOARD_BRAND?.trim() || "Operations";

  const invAlert =
    lowStock[0] != null
      ? {
          category: lowStock[0].name.split(/[\s/]/)[0] ?? "Inventory",
          message: `Resupply soon — ${lowStock[0].name} at or below threshold`,
        }
      : null;

  return {
    title: `${brand} Dashboard`,
    welcomeName: "",
    alerts,
    workforce: {
      dateLabel: new Date().toLocaleDateString("en-US", {
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
      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pulse-accent ring-1 ring-blue-100">
        {tag.label}
      </span>
    );
  }
  if (tag.kind === "overdue") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {tag.label}
      </span>
    );
  }
  return (
    <span className="shrink-0 self-start rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
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
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
  hideHeaderWelcome?: boolean;
  zonePromptDismissed?: boolean;
  onDismissZonePrompt?: () => void;
}) {
  const userInitials = headerInitials(model.welcomeName);

  return (
    <div className="overflow-hidden rounded-2xl border border-pulse-border bg-white shadow-lg ring-1 ring-slate-900/[0.05]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-pulse-border bg-slate-50/80 px-4 py-4 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-pulse-navy sm:text-lg md:text-xl lg:text-2xl">
          {model.title}
        </span>
        <div className="flex justify-center">
          <Image
            src="/images/panologo.png"
            alt=""
            width={120}
            height={32}
            className="h-7 w-auto max-w-[min(100%,11rem)] object-contain object-center md:h-8"
          />
        </div>
        {!hideHeaderWelcome ? (
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <p className="min-w-0 truncate text-xs text-pulse-muted sm:text-sm">
              Welcome,{" "}
              <span className="font-semibold text-pulse-navy">{model.welcomeName}</span>
            </p>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-pulse-accent ring-2 ring-white">
              {userInitials.slice(0, 2)}
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pulse-accent text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white"
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

      <div className="grid gap-4 bg-gradient-to-br from-white to-slate-50/90 p-5 lg:grid-cols-12 lg:p-6">
        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-12 lg:p-6"
          data-dashboard-tile="alerts"
        >
          <h3 className="text-base font-bold text-pulse-navy">Active Alerts</h3>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
            {model.alerts.map((a, idx) => (
              <li
                key={`${a.title}-${idx}`}
                className={`flex gap-3 rounded-xl p-4 ${
                  a.severity === "critical"
                    ? "border border-red-100 bg-red-50/50"
                    : "border border-amber-100 bg-amber-50/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-1 shrink-0 rounded-full ${
                    a.severity === "critical" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-pulse-navy">{a.title}</p>
                  {a.subtitle ? (
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-pulse-muted">
                      {a.subtitle}
                    </p>
                  ) : null}
                </div>
                {a.severity === "critical" ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                ) : (
                  <Radio className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-5 lg:min-h-[280px] lg:p-6"
          data-dashboard-tile="workforce"
        >
          <h3 className="text-base font-bold text-pulse-navy">Workforce</h3>
          <p className="mt-2 text-sm font-semibold text-pulse-navy">
            Today – {model.workforce.dateLabel}
          </p>
          <p className="mt-2 text-xs text-pulse-muted">{model.workforce.summaryLine}</p>

          <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/90">
                  On-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onsite.length === 0 ? (
                    <p className="text-sm text-pulse-muted">No one on shift right now.</p>
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
                          <span className={`${roleBadgeBase} bg-pulse-accent`}>S</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/90">
                  Off-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.offsite.length === 0 ? (
                    <p className="text-sm text-pulse-muted">—</p>
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
            <div className="shrink-0 border-t border-pulse-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Absent</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {model.workforce.absent.length === 0 ? (
                  <p className="text-sm text-pulse-muted">—</p>
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

          <div className="mt-4 flex flex-wrap gap-2 border-t border-pulse-border pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On-site · {model.workforce.counts.onsite}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Off-site · {model.workforce.counts.offsite}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Absent · {model.workforce.counts.absent}
            </span>
          </div>
        </section>

        <section
          className="rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-7 lg:p-6"
          data-dashboard-tile="work-requests"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-bold text-pulse-navy">Work Requests</h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-tight text-amber-950 ring-1 ring-amber-200/80">
              {model.workRequests.awaitingCount} requests awaiting assignment
            </span>
          </div>
          <p className="mt-2 text-xs">
            <Link href={workOrdersHref} className="font-medium text-pulse-accent hover:underline">
              Open work orders view →
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {model.workRequests.newest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Newest</p>
                <div className="mt-2 rounded-xl border border-pulse-border bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-pulse-navy">{model.workRequests.newest.title}</p>
                      <p className="mt-1 text-xs text-pulse-muted">{model.workRequests.newest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.newest.tag} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-pulse-muted">No open work requests in the live feed.</p>
            )}

            {model.workRequests.oldest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Oldest</p>
                <div className="mt-2 rounded-xl border border-pulse-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-pulse-navy">{model.workRequests.oldest.title}</p>
                      <p className="mt-1 text-xs text-pulse-muted">{model.workRequests.oldest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.oldest.tag} />
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700/90">
                High priority / Critical
              </p>
              {model.workRequests.critical.length === 0 ? (
                <p className="mt-2 text-sm text-pulse-muted">No high-priority items right now.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-3">
                  {model.workRequests.critical.map((row) => (
                    <li
                      key={row.title}
                      className="flex gap-3 rounded-xl border border-red-100 bg-red-50/35 p-3 ring-1 ring-red-100/60"
                    >
                      <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-pulse-navy">{row.title}</p>
                        <p className="mt-0.5 text-xs text-pulse-muted">{row.subtitle}</p>
                      </div>
                      <span className="shrink-0 self-start rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
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
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-6"
          data-dashboard-tile="equipment"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Equipment Update</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-pulse-navy md:text-3xl">
            {model.equipment.activeCount} Active Tools
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {model.equipment.missingCount} Missing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {model.equipment.outOfServiceCount} Out of Service
            </span>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-pulse-border pt-4">
            {model.equipment.showZonePrompt && !zonePromptDismissed ? (
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-sm">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-pulse-navy">
                      Several tools are accounted for, but may need zone checks.
                    </p>
                    <p className="mt-1 text-xs text-pulse-muted">Schedule a cleanup?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        className="inline-flex rounded-lg bg-pulse-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover"
                      >
                        Review inventory
                      </Link>
                      <button
                        type="button"
                        onClick={onDismissZonePrompt}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {model.equipment.showBatteryNote ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-slate-700 shadow-sm">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200/80">
                    <Battery className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-pulse-navy">
                    Beacon equipment registered — confirm batteries and swaps on the floor before the next shift.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-pulse-border bg-white p-5 shadow-sm lg:col-span-6"
          data-dashboard-tile="inventory"
        >
          <h3 className="text-base font-bold text-pulse-navy">Inventory Status</h3>
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-pulse-border bg-slate-50/50 p-4">
              <div>
                <p className="text-sm font-semibold text-pulse-navy">Consumables</p>
                <p className="mt-1 text-xs text-pulse-muted">
                  {model.inventory.consumablesOk
                    ? "Stock within target range"
                    : "One or more items need attention"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  model.inventory.consumablesOk
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                {model.inventory.consumablesOk ? "OK" : "Review"}
              </span>
            </div>

            {model.inventory.alert ? (
              <div className="rounded-xl border border-pulse-border bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">
                  Inventory Alert
                </p>
                <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-pulse-navy">{model.inventory.alert.category}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-900">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      {model.inventory.alert.message}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                    Soon
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50"
                  >
                    View stock
                  </Link>
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="rounded-lg bg-pulse-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-pulse-muted">No low-stock alerts.</p>
            )}

            <div className="border-t border-pulse-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">
                Shopping List
              </p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-3 text-sm text-pulse-muted">Add items from low-stock alerts.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {model.inventory.shoppingList.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-pulse-navy"
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 rounded border border-slate-300 bg-white"
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

      <footer className="border-t border-pulse-border bg-slate-50/60 px-6 py-3 text-center text-xs font-medium text-pulse-muted">
        Powered by Helix Systems
      </footer>
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
  onReady?: () => void;
}) {
  const [liveModel, setLiveModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(variant === "live");
  const [error, setError] = useState<string | null>(null);
  const [zoneDismissed, setZoneDismissed] = useState(false);
  const readyNotifiedRef = useRef(false);

  const workOrdersHref =
    pulseTenantNav.find((n) => n.href === "/dashboard/work-requests")?.href ?? "/pulse#work-requests";

  const notifyReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReady?.();
  }, [onReady]);

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

    setLoading(true);
    setError(null);
    const now = new Date();
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
      const model = buildLiveModel(dash, wrList, workers, shiftList, assetList, lowStock, zoneList, beaconList);
      const auth = readSession();
      const welcome = welcomeFromSession(auth?.email, auth?.full_name);
      setLiveModel({ ...model, welcomeName: welcome });
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
      notifyReady();
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
      notifyReady();
    }
  }, [variant, notifyReady]);

  if (variant === "demo") {
    return <DashboardBody model={demoModel()} workOrdersHref={workOrdersHref} />;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-pulse-border bg-white p-12 text-center shadow-card">
        <p className="text-sm text-pulse-muted">Loading live dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
        <p className="text-sm text-amber-950" role="status">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void fetchLive()}
          className="mt-4 rounded-xl bg-pulse-accent px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-accent-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!liveModel) {
    return (
      <p className="text-sm text-pulse-muted">No dashboard data available.</p>
    );
  }

  return (
    <DashboardBody
      model={liveModel}
      workOrdersHref={workOrdersHref}
      hideHeaderWelcome
      zonePromptDismissed={zoneDismissed}
      onDismissZonePrompt={() => setZoneDismissed(true)}
    />
  );
}
