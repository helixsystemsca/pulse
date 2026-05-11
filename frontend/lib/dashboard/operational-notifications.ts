import { getServerNow } from "@/lib/serverTime";

export type AlertPriority = "critical" | "high" | "medium" | "low";

export type OperationalNotificationItem = {
  id: string;
  severity: "critical" | "warning";
  priority?: AlertPriority;
  title: string;
  subtitle?: string;
  countsTowardTotals?: boolean;
  /**
   * When set and falls in the viewer’s local calendar day, the item appears under “Today”
   * (sorted newest-first). Items without a timestamp appear only under “Earlier”.
   */
  eventAtMs?: number;
};

export const NO_ACTIVE_OPERATIONS_ALERTS_TITLE = "No active alerts";

type ZoneLike = { id: string; name: string };
type AssetLike = { id: string; name: string; zone_id: string | null; status: string };
type InventoryLike = { id: string; name: string; quantity: number; low_stock_threshold: number };
type DashboardLike = { alerts: string[] };

export function notificationAlertPriority(a: OperationalNotificationItem): AlertPriority {
  if (a.priority) return a.priority;
  return a.severity === "critical" ? "critical" : "medium";
}

export function notificationSeveritySortRank(a: OperationalNotificationItem): number {
  const p = notificationAlertPriority(a);
  switch (p) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}

export function notificationCountsFromAlerts(alerts: OperationalNotificationItem[]): {
  criticalCount: number;
  warningCount: number;
} {
  const real = alerts.filter((a) => a.countsTowardTotals !== false);
  return {
    criticalCount: real.filter((a) => notificationAlertPriority(a) === "critical").length,
    warningCount: real.filter((a) => {
      const p = notificationAlertPriority(a);
      return p === "high" || p === "medium" || p === "low";
    }).length,
  };
}

function localCalendarDayBoundsMs(nowMs: number): { dayStartMs: number; dayEndMsExclusive: number } {
  const anchor = new Date(nowMs);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEndExclusive = new Date(dayStart);
  dayEndExclusive.setDate(dayEndExclusive.getDate() + 1);
  return { dayStartMs: dayStart.getTime(), dayEndMsExclusive: dayEndExclusive.getTime() };
}

export function buildOperationalNotificationItems(input: {
  dashboard: DashboardLike;
  assets: AssetLike[];
  lowStock: InventoryLike[];
  zones: ZoneLike[];
  nowMs: number;
}): OperationalNotificationItem[] {
  const { dashboard, assets, lowStock, zones, nowMs } = input;
  const zoneName = (id: string | null) => (id ? zones.find((z) => z.id === id)?.name ?? "Unknown zone" : "Unassigned");

  const missingTools = assets.filter((a) => a.status === "missing");
  const oos = assets.filter((a) => a.status === "maintenance");

  const alerts: OperationalNotificationItem[] = [];
  let seq = 0;
  const bump = () => {
    seq += 1;
    return nowMs + seq;
  };

  for (const t of missingTools.slice(0, 3)) {
    alerts.push({
      id: `missing-${t.id}`,
      severity: "critical",
      priority: "critical",
      title: `Missing · ${t.name}`,
      subtitle: `Last known zone: ${zoneName(t.zone_id)}`,
      eventAtMs: bump(),
    });
  }
  for (const t of oos.slice(0, 2)) {
    alerts.push({
      id: `oos-${t.id}`,
      severity: "warning",
      priority: "high",
      title: `Out of service · ${t.name}`,
      subtitle: `Zone: ${zoneName(t.zone_id)}`,
      eventAtMs: bump(),
    });
  }
  for (const row of lowStock.slice(0, 3)) {
    alerts.push({
      id: `low-stock-${row.id}`,
      severity: "warning",
      priority: "low",
      title: `Low stock · ${row.name}`,
      subtitle: `Qty ${row.quantity} at or below threshold (${row.low_stock_threshold} ${"units"})`,
      eventAtMs: bump(),
    });
  }
  for (const msg of dashboard.alerts) {
    if (alerts.length >= 8) break;
    alerts.push({
      id: `dash-${alerts.length}-${msg.slice(0, 24)}`,
      severity: "warning",
      priority: "medium",
      title: msg,
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: "no-active-alerts",
      severity: "warning",
      priority: "low",
      title: NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
      subtitle: "Operations look clear. New exceptions will surface here.",
      countsTowardTotals: false,
      eventAtMs: bump(),
    });
  }

  return alerts;
}

/** Items shown in the header badge (excludes padding / “all clear” row). */
export function notificationBadgeCount(items: OperationalNotificationItem[]): number {
  return items.filter(
    (a) => a.countsTowardTotals !== false && a.title !== NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
  ).length;
}

export function partitionNotificationsForModal(
  items: OperationalNotificationItem[],
  nowMs: number = getServerNow(),
): { today: OperationalNotificationItem[]; other: OperationalNotificationItem[] } {
  const { dayStartMs, dayEndMsExclusive } = localCalendarDayBoundsMs(nowMs);
  const content = items.filter(
    (a) => a.countsTowardTotals !== false && a.title !== NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
  );

  const today: OperationalNotificationItem[] = [];
  const other: OperationalNotificationItem[] = [];
  for (const a of content) {
    const t = a.eventAtMs;
    if (t != null && Number.isFinite(t) && t >= dayStartMs && t < dayEndMsExclusive) {
      today.push(a);
    } else {
      other.push(a);
    }
  }

  today.sort(
    (a, b) =>
      (b.eventAtMs ?? 0) - (a.eventAtMs ?? 0) ||
      notificationSeveritySortRank(b) - notificationSeveritySortRank(a) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
  other.sort(
    (a, b) =>
      notificationSeveritySortRank(b) - notificationSeveritySortRank(a) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );

  return { today, other };
}

export function notificationTone(
  a: OperationalNotificationItem,
): "critical" | "warn" | "info" {
  if (a.severity === "critical") return "critical";
  if (notificationAlertPriority(a) === "high") return "warn";
  return "info";
}
