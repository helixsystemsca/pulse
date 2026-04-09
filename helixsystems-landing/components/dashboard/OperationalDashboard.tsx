"use client";

import { AlertTriangle, Battery, Info, MapPin, Package, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminOnboardingChecklist } from "@/components/onboarding/AdminOnboardingChecklist";
import { apiFetch, isApiMode } from "@/lib/api";
import { fetchSetupProgress } from "@/lib/onboardingService";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseTenantNav } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { getServerDate, getServerNow } from "@/lib/serverTime";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

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
  "pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--ds-surface-primary)]";

/** Dashboard workforce bubbles: gold fill + black initials; `WorkforceBubbleFace` shows profile photo when `avatar_url` is set. */
const workforceAvatarGoldBase =
  "rounded-full bg-ds-warning font-bold text-ds-on-accent shadow-sm ring-1 ring-black/20 ring-offset-2 ring-offset-[var(--ds-surface-primary)]";

function onsiteAvatarClass(badge?: "L" | "S") {
  const isLead = badge === "L";
  const shared = `relative shrink-0 items-center justify-center ${workforceAvatarGoldBase} transition-transform`;
  if (isLead) {
    return `z-[1] flex h-14 w-14 text-base shadow-[var(--ds-shadow-card)] ring-2 ring-black/25 md:h-16 md:w-16 md:text-lg ${shared}`;
  }
  return `flex h-11 w-11 text-xs md:h-12 md:w-12 md:text-sm ${shared}`;
}

function offsiteAvatarClass() {
  return `flex h-11 w-11 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs md:h-12 md:w-12 md:text-sm`;
}

function absentAvatarClass() {
  return `relative flex h-10 w-10 shrink-0 items-center justify-center ${workforceAvatarGoldBase} text-xs opacity-[0.96] after:absolute after:bottom-0 after:right-0 after:z-10 after:h-2.5 after:w-2.5 after:rounded-full after:bg-ds-danger after:ring-2 after:ring-[var(--ds-surface-primary)] md:h-11 md:w-11 md:text-sm`;
}

function WorkforceBubbleFace({ initials, avatarUrl }: { initials: string; avatarUrl?: string | null }) {
  const src = useResolvedAvatarSrc(avatarUrl ?? null);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-full w-full rounded-full object-cover object-center"
      />
    );
  }
  return <>{initials}</>;
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
  avatar_url?: string | null;
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
    return { id: w.id, initials, title, kind, badge, avatar_url: w.avatar_url };
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
    <div className="ds-dashboard-shell">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-ds-border bg-ds-primary px-4 py-4 sm:px-6">
        <span className="min-w-0 text-base font-bold leading-tight tracking-tight text-ds-foreground sm:text-lg md:text-xl lg:text-2xl">
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

      <div className="grid gap-5 p-5 lg:grid-cols-12 lg:gap-6 lg:p-6">
        {facilitySetupChecklist}
        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-12 lg:p-6"
          data-dashboard-tile="alerts"
        >
          <h3 className="text-base font-bold text-ds-foreground">Active Alerts</h3>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
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
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-5 lg:min-h-[280px] lg:p-6"
          data-dashboard-tile="workforce"
        >
          <h3 className="text-base font-bold text-ds-foreground">Workforce</h3>
          <p className="mt-2 text-sm font-semibold text-ds-foreground">
            Today – {model.workforce.dateLabel}
          </p>
          <p className="mt-2 text-xs text-ds-muted">{model.workforce.summaryLine}</p>

          <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-success">
                  On-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.onsite.length === 0 ? (
                    <p className="text-sm text-ds-muted">
                      No one on shift right now. Add shifts under{" "}
                      <Link href="/schedule" className="ds-link font-medium">
                        Schedule
                      </Link>{" "}
                      when your roster is ready.
                    </p>
                  ) : (
                    model.workforce.onsite.map((b) => (
                      <span
                        key={b.id}
                        title={b.title}
                        className={onsiteAvatarClass(b.badge)}
                      >
                        <WorkforceBubbleFace initials={b.initials} avatarUrl={b.avatar_url} />
                        {b.badge === "L" ? (
                          <span className={`${roleBadgeBase} bg-ds-success text-ds-on-accent`}>L</span>
                        ) : null}
                        {b.badge === "S" ? (
                          <span className={`${roleBadgeBase} bg-ds-success text-ds-on-accent`}>
                            S
                          </span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-warning">
                  Off-site
                </p>
                <div className="flex flex-wrap gap-3">
                  {model.workforce.offsite.length === 0 ? (
                    <p className="text-sm text-ds-muted">—</p>
                  ) : (
                    model.workforce.offsite.map((b) => (
                      <span key={b.id} title={b.title} className={offsiteAvatarClass()}>
                        <WorkforceBubbleFace initials={b.initials} avatarUrl={b.avatar_url} />
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-ds-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-danger">Absent</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {model.workforce.absent.length === 0 ? (
                  <p className="text-sm text-ds-muted">—</p>
                ) : (
                  model.workforce.absent.map((b) => (
                    <span key={b.id} title={b.title} className={absentAvatarClass()}>
                      <WorkforceBubbleFace initials={b.initials} avatarUrl={b.avatar_url} />
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-ds-border pt-4">
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
            <h3 className="text-base font-bold text-ds-foreground">Work Requests</h3>
            <span className="app-badge-amber inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-tight">
              {model.workRequests.awaitingCount} requests awaiting assignment
            </span>
          </div>
          <p className="mt-2 text-xs">
            <Link
              href={workOrdersHref}
              className="ds-link"
            >
              Open work orders view →
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {model.workRequests.newest ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                  Newest
                </p>
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
                    <li
                      key={row.title}
                      className="ds-notification ds-notification-critical flex gap-3 p-3"
                    >
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
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-6"
          data-dashboard-tile="equipment"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Equipment Update</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ds-foreground md:text-3xl">
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
                        href={pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory"}
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
        </section>

        <section
          className="app-dashboard-tile flex flex-col p-5 lg:col-span-6"
          data-dashboard-tile="inventory"
        >
          <h3 className="text-base font-bold text-ds-foreground">Inventory Status</h3>
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-md border border-ds-border bg-transparent p-4">
              <div>
                <p className="text-sm font-semibold text-ds-foreground">Consumables</p>
                <p className="mt-1 text-xs text-ds-muted">
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
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                  Inventory Alert
                </p>
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                Shopping List
              </p>
              {model.inventory.shoppingList.length === 0 ? (
                <p className="mt-3 text-sm text-ds-muted">Add items from low-stock alerts.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {model.inventory.shoppingList.map((item) => (
                    <li
                      key={item}
                      className="ds-table-row-hover flex cursor-default items-center gap-2 rounded-md border border-ds-border bg-transparent px-3 py-2 text-sm text-ds-foreground"
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 rounded border border-ds-border bg-transparent"
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

  const facilitySetupSlot =
    variant === "live" && session && canAccessPulseTenantApis(session) ? <AdminOnboardingChecklist /> : null;

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
