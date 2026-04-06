"use client";

import { AlertTriangle, Battery, MapPin, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HelixMarketingLogo } from "@/components/branding/HelixMarketingLogo";
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
  "pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-stealth-card";

function onsiteAvatarClass(badge?: "L" | "S") {
  const isLead = badge === "L";
  const shared =
    "relative shrink-0 items-center justify-center rounded-full bg-stealth-success/15 font-bold text-stealth-success shadow-md ring-1 ring-stealth-success/35 ring-offset-2 ring-offset-stealth-card transition-transform";
  if (isLead) {
    return `z-[1] flex h-14 w-14 text-base shadow-stealth-card ring-2 ring-stealth-success/45 md:h-16 md:w-16 md:text-lg ${shared}`;
  }
  return `flex h-11 w-11 text-xs shadow-sm md:h-12 md:w-12 md:text-sm ${shared}`;
}

function offsiteAvatarClass() {
  return "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stealth-warning/12 text-xs font-bold text-stealth-warning shadow-sm ring-1 ring-stealth-warning/35 ring-offset-2 ring-offset-stealth-card md:h-12 md:w-12 md:text-sm";
}

function absentAvatarClass() {
  return "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stealth-danger/10 text-xs font-bold text-stealth-danger opacity-[0.92] shadow-sm ring-1 ring-stealth-danger/35 ring-offset-2 ring-offset-stealth-card after:absolute after:bottom-0 after:right-0 after:z-10 after:h-2.5 after:w-2.5 after:rounded-full after:bg-stealth-danger after:ring-2 after:ring-stealth-card md:h-11 md:w-11 md:text-sm";
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
      <span className="shrink-0 rounded-full bg-stealth-accent/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-stealth-accent ring-1 ring-stealth-accent/25">
        {tag.label}
      </span>
    );
  }
  if (tag.kind === "overdue") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-stealth-warning/10 px-2 py-0.5 text-[11px] font-bold text-stealth-warning ring-1 ring-stealth-warning/30">
        <span className="h-1.5 w-1.5 rounded-full bg-stealth-warning" />
        {tag.label}
      </span>
    );
  }
  return (
    <span className="shrink-0 self-start rounded-md bg-stealth-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stealth-danger ring-1 ring-stealth-danger/35">
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
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
  hideHeaderWelcome?: boolean;
  zonePromptDismissed?: boolean;
  onDismissZonePrompt?: () => void;
  /** Tenant banner for Operations header only; omit or null when unset — no placeholder. */
  headerImageUrl?: string | null;
}) {
  const userInitials = headerInitials(model.welcomeName);
  const trimmedHeaderImage = headerImageUrl?.trim() || null;

  return (
    <div className="overflow-hidden rounded-2xl border border-stealth-border bg-stealth-main shadow-stealth-card">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stealth-border bg-stealth-card px-4 py-4 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-stealth-primary sm:text-lg md:text-xl lg:text-2xl">
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
            <p className="min-w-0 truncate text-xs text-stealth-secondary sm:text-sm">
              Welcome,{" "}
              <span className="font-semibold text-stealth-primary">{model.welcomeName}</span>
            </p>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stealth-accent/15 text-xs font-bold text-stealth-accent ring-2 ring-stealth-border">
              {userInitials.slice(0, 2)}
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-stealth-accent text-[9px] font-bold leading-none text-stealth-primary shadow-stealth-card ring-2 ring-stealth-card"
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

      <div className="grid gap-4 bg-stealth-main p-5 lg:grid-cols-12 lg:p-6">
        <section
          className="flex flex-col rounded-2xl border border-stealth-border bg-stealth-card p-5 shadow-stealth-card lg:col-span-12 lg:p-6"
          data-dashboard-tile="alerts"
        >
          <h3 className="text-base font-bold text-stealth-primary">Active Alerts</h3>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
            {model.alerts.map((a, idx) => (
              <li
                key={`${a.title}-${idx}`}
                className={`flex gap-3 rounded-xl border border-stealth-border p-4 ${
                  a.severity === "critical"
                    ? "border-l-2 border-l-stealth-danger bg-stealth-danger/[0.06]"
                    : "border-l-2 border-l-stealth-warning bg-stealth-warning/[0.06]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-1 shrink-0 rounded-full ${
                    a.severity === "critical" ? "bg-stealth-danger/80" : "bg-stealth-warning/80"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-stealth-primary">{a.title}</p>
                  {a.subtitle ? (
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stealth-secondary">
                      {a.subtitle}
                    </p>
                  ) : null}
                </div>
                {a.severity === "critical" ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-stealth-danger/90" aria-hidden />
                ) : (
                  <Radio className="h-5 w-5 shrink-0 text-stealth-warning/90" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-stealth-border bg-stealth-card p-5 shadow-stealth-card lg:col-span-5 lg:min-h-[280px] lg:p-6"
          data-dashboard-tile="workforce"
        >
          <h3 className="text-base font-bold text-stealth-primary">Workforce</h3>
          <p className="mt-2 text-sm font-semibold text-stealth-primary">
            Today – {model.workforce.dateLabel}
          </p>
          <p className="mt-2 text-xs text-stealth-muted">{model.workforce.summaryLine}</p>

          <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-success">
                  On-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onsite.length === 0 ? (
                    <p className="text-sm text-stealth-muted">No one on shift right now.</p>
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
                          <span className={`${roleBadgeBase} bg-stealth-accent`}>S</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-warning">
                  Off-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.offsite.length === 0 ? (
                    <p className="text-sm text-stealth-muted">—</p>
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
            <div className="shrink-0 border-t border-stealth-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-danger">Absent</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {model.workforce.absent.length === 0 ? (
                  <p className="text-sm text-stealth-muted">—</p>
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

          <div className="mt-4 flex flex-wrap gap-2 border-t border-stealth-border pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stealth-success/10 px-2.5 py-1 text-[11px] font-semibold text-stealth-success ring-1 ring-stealth-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-stealth-success" />
              On-site · {model.workforce.counts.onsite}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stealth-warning/10 px-2.5 py-1 text-[11px] font-semibold text-stealth-warning ring-1 ring-stealth-warning/25">
              <span className="h-1.5 w-1.5 rounded-full bg-stealth-warning" />
              Off-site · {model.workforce.counts.offsite}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stealth-danger/10 px-2.5 py-1 text-[11px] font-semibold text-stealth-danger ring-1 ring-stealth-danger/25">
              <span className="h-1.5 w-1.5 rounded-full bg-stealth-danger" />
              Absent · {model.workforce.counts.absent}
            </span>
          </div>
        </section>

        <section
          className="rounded-2xl border border-stealth-border bg-stealth-card p-5 shadow-stealth-card lg:col-span-7 lg:p-6"
          data-dashboard-tile="work-requests"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-bold text-stealth-primary">Work Requests</h3>
            <span className="inline-flex items-center rounded-full bg-stealth-warning/10 px-3 py-1 text-xs font-bold tracking-tight text-stealth-warning ring-1 ring-stealth-warning/25">
              {model.workRequests.awaitingCount} requests awaiting assignment
            </span>
          </div>
          <p className="mt-2 text-xs">
            <Link
              href={workOrdersHref}
              className="font-medium text-stealth-accent hover:text-stealth-accent/80 hover:underline"
            >
              Open work orders view →
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {model.workRequests.newest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-muted">
                  Newest
                </p>
                <div className="mt-2 rounded-xl border border-stealth-border bg-stealth-main/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stealth-primary">{model.workRequests.newest.title}</p>
                      <p className="mt-1 text-xs text-stealth-secondary">{model.workRequests.newest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.newest.tag} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stealth-muted">No open work requests in the live feed.</p>
            )}

            {model.workRequests.oldest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-muted">Oldest</p>
                <div className="mt-2 rounded-xl border border-stealth-border bg-stealth-main/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stealth-primary">{model.workRequests.oldest.title}</p>
                      <p className="mt-1 text-xs text-stealth-secondary">{model.workRequests.oldest.subtitle}</p>
                    </div>
                    <TagPill tag={model.workRequests.oldest.tag} />
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-danger/90">
                High priority / Critical
              </p>
              {model.workRequests.critical.length === 0 ? (
                <p className="mt-2 text-sm text-stealth-muted">No high-priority items right now.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-3">
                  {model.workRequests.critical.map((row) => (
                    <li
                      key={row.title}
                      className="flex gap-3 rounded-xl border border-stealth-border border-l-2 border-l-stealth-danger bg-stealth-danger/[0.06] p-3"
                    >
                      <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-stealth-danger/80" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stealth-primary">{row.title}</p>
                        <p className="mt-0.5 text-xs text-stealth-secondary">{row.subtitle}</p>
                      </div>
                      <span className="shrink-0 self-start rounded-md bg-stealth-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stealth-danger ring-1 ring-stealth-danger/35">
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
          className="flex flex-col rounded-2xl border border-stealth-border bg-stealth-card p-5 shadow-stealth-card lg:col-span-6"
          data-dashboard-tile="equipment"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-stealth-muted">Equipment Update</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-stealth-primary md:text-3xl">
            {model.equipment.activeCount} Active Tools
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stealth-warning/10 px-3 py-1 text-xs font-semibold text-stealth-warning ring-1 ring-stealth-warning/25">
              <span className="h-1.5 w-1.5 rounded-full bg-stealth-warning" />
              {model.equipment.missingCount} Missing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stealth-danger/10 px-3 py-1 text-xs font-semibold text-stealth-danger ring-1 ring-stealth-danger/25">
              <span className="h-1.5 w-1.5 rounded-full bg-stealth-danger" />
              {model.equipment.outOfServiceCount} Out of Service
            </span>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-stealth-border pt-4">
            {model.equipment.showZonePrompt && !zonePromptDismissed ? (
              <div className="rounded-xl border border-stealth-border border-l-2 border-l-stealth-warning bg-stealth-warning/[0.06] p-4 shadow-stealth-card">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stealth-warning/10 text-stealth-warning ring-1 ring-stealth-warning/20">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-stealth-primary">
                      Several tools are accounted for, but may need zone checks.
                    </p>
                    <p className="mt-1 text-xs text-stealth-muted">Schedule a cleanup?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                        className="inline-flex rounded-lg bg-stealth-accent px-3 py-1.5 text-xs font-semibold text-stealth-primary shadow-stealth-card transition-[filter] hover:brightness-110"
                      >
                        Review inventory
                      </Link>
                      <button
                        type="button"
                        onClick={onDismissZonePrompt}
                        className="rounded-lg border border-stealth-border bg-stealth-main/50 px-3 py-1.5 text-xs font-semibold text-stealth-primary shadow-stealth-card transition-colors hover:bg-stealth-border/40"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {model.equipment.showBatteryNote ? (
              <div className="rounded-xl border border-stealth-border bg-stealth-main/50 p-4 text-stealth-secondary shadow-stealth-card">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stealth-card text-stealth-muted ring-1 ring-stealth-border">
                    <Battery className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-stealth-primary">
                    Beacon equipment registered — confirm batteries and swaps on the floor before the next shift.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-stealth-border bg-stealth-card p-5 shadow-stealth-card lg:col-span-6"
          data-dashboard-tile="inventory"
        >
          <h3 className="text-base font-bold text-stealth-primary">Inventory Status</h3>
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-stealth-border bg-stealth-main/50 p-4">
              <div>
                <p className="text-sm font-semibold text-stealth-primary">Consumables</p>
                <p className="mt-1 text-xs text-stealth-muted">
                  {model.inventory.consumablesOk
                    ? "Stock within target range"
                    : "One or more items need attention"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  model.inventory.consumablesOk
                    ? "bg-stealth-success/10 text-stealth-success ring-stealth-success/25"
                    : "bg-stealth-warning/10 text-stealth-warning ring-stealth-warning/25"
                }`}
              >
                {model.inventory.consumablesOk ? "OK" : "Review"}
              </span>
            </div>

            {model.inventory.alert ? (
              <div className="rounded-xl border border-stealth-border bg-stealth-main/30 p-4 shadow-stealth-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-muted">
                  Inventory Alert
                </p>
                <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-stealth-border border-l-2 border-l-stealth-warning bg-stealth-warning/[0.06] p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stealth-primary">{model.inventory.alert.category}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-stealth-warning">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-stealth-warning" />
                      {model.inventory.alert.message}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stealth-warning/10 px-2 py-0.5 text-[11px] font-semibold text-stealth-warning ring-1 ring-stealth-warning/25">
                    Soon
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="rounded-lg border border-stealth-border bg-stealth-main/50 px-3 py-1.5 text-xs font-semibold text-stealth-primary shadow-stealth-card transition-colors hover:bg-stealth-border/40"
                  >
                    View stock
                  </Link>
                  <Link
                    href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
                    className="rounded-lg bg-stealth-accent px-3 py-1.5 text-xs font-semibold text-stealth-primary shadow-stealth-card transition-[filter] hover:brightness-110"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stealth-muted">No low-stock alerts.</p>
            )}

            <div className="border-t border-stealth-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stealth-muted">
                Shopping List
              </p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-3 text-sm text-stealth-muted">Add items from low-stock alerts.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {model.inventory.shoppingList.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 rounded-lg border border-stealth-border bg-stealth-main/40 px-3 py-2 text-sm text-stealth-primary transition-colors hover:bg-stealth-border/25"
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 rounded border border-stealth-border bg-stealth-card"
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

      <footer className="flex flex-col items-center justify-center gap-2 border-t border-stealth-border bg-stealth-card/40 px-6 py-3 text-center">
        <span className="sr-only">Powered by Helix Systems</span>
        <div className="flex items-center justify-center opacity-60">
          <HelixMarketingLogo variant="compact" className="" />
        </div>
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
  onReady?: (payload?: OperationalDashboardReadyPayload) => void;
}) {
  const { session } = usePulseAuth();
  const [liveModel, setLiveModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(variant === "live");
  const [error, setError] = useState<string | null>(null);
  const [zoneDismissed, setZoneDismissed] = useState(false);
  const readyNotifiedRef = useRef(false);

  const workOrdersHref =
    pulseTenantNav.find((n) => n.href === "/dashboard/work-requests")?.href ?? "/pulse#work-requests";

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

  if (variant === "demo") {
    return (
      <DashboardBody model={demoModel()} workOrdersHref={workOrdersHref} />
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stealth-border bg-stealth-card p-12 text-center shadow-stealth-card">
        <p className="text-sm text-stealth-muted">Loading live dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-stealth-border border-l-2 border-l-stealth-warning bg-stealth-warning/[0.06] p-6 shadow-stealth-card">
        <p className="text-sm text-stealth-warning" role="status">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void fetchLive()}
          className="mt-4 rounded-xl bg-stealth-accent px-4 py-2 text-sm font-semibold text-stealth-primary transition-[filter] hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!liveModel) {
    return (
      <p className="text-sm text-stealth-muted">No dashboard data available.</p>
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
    />
  );
}
