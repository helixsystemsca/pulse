import { AlertsXs } from "@/components/dashboard/widgets/alerts/views/xs";
import { AlertsSm } from "@/components/dashboard/widgets/alerts/views/sm";
import { AlertsMd } from "@/components/dashboard/widgets/alerts/views/md";
import { AlertsLg } from "@/components/dashboard/widgets/alerts/views/lg";
import { AlertsXl } from "@/components/dashboard/widgets/alerts/views/xl";
import type { WidgetMode, WidgetRenderContext } from "@/components/dashboard/widgets/widgetSizing";

export type AlertsWidgetAlert = {
  severity: "critical" | "warning";
  priority?: "critical" | "high" | "medium" | "low";
  title: string;
  subtitle?: string;
  countsTowardTotals?: boolean;
};

export const NO_ACTIVE_ALERTS_TITLE = "No active alerts";
export const NO_ADDITIONAL_ALERTS_TITLE = "No additional alerts";

type AlertsViewProps = {
  alerts: AlertsWidgetAlert[];
  /** Alerts sorted by priority (no padding rows). */
  realAlerts: AlertsWidgetAlert[];
};

function priority(a: AlertsWidgetAlert): AlertsWidgetAlert["priority"] {
  if (a.priority) return a.priority;
  return a.severity === "critical" ? "critical" : "medium";
}

function rank(p: NonNullable<AlertsWidgetAlert["priority"]>): number {
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

function compare(a: AlertsWidgetAlert, b: AlertsWidgetAlert): number {
  const dr = rank(priority(a) ?? "low") - rank(priority(b) ?? "low");
  if (dr !== 0) return dr;
  return a.title.localeCompare(b.title);
}

function realSorted(alerts: AlertsWidgetAlert[]): AlertsWidgetAlert[] {
  return alerts
    .filter((a) => a.countsTowardTotals !== false)
    .filter((a) => a.title !== NO_ACTIVE_ALERTS_TITLE)
    .slice()
    .sort(compare);
}

function paddedRows(alerts: AlertsWidgetAlert[], count: number): AlertsWidgetAlert[] {
  const real = realSorted(alerts);
  const rows: AlertsWidgetAlert[] = [];
  if (real.length === 0) {
    rows.push({
      severity: "warning",
      priority: "low",
      title: NO_ACTIVE_ALERTS_TITLE,
      subtitle: "Operations look clear. New exceptions will surface here.",
      countsTowardTotals: false,
    });
  } else {
    rows.push(...real.slice(0, count));
  }
  while (rows.length < count) {
    rows.push({
      severity: "warning",
      priority: "low",
      title: NO_ADDITIONAL_ALERTS_TITLE,
      subtitle: "No further high-priority exceptions in this snapshot.",
      countsTowardTotals: false,
    });
  }
  return rows.slice(0, count);
}

export function AlertsWidget({ alerts, ctx }: { alerts: AlertsWidgetAlert[]; ctx?: WidgetRenderContext }) {
  const mode = ctx?.mode ?? "md";
  const realAlerts = realSorted(alerts);
  const props: AlertsViewProps =
    mode === "xs"
      ? { alerts: paddedRows(alerts, 1), realAlerts }
      : mode === "sm"
        ? { alerts: paddedRows(alerts, 2), realAlerts }
        : mode === "md"
          ? { alerts: paddedRows(alerts, 3), realAlerts }
          : mode === "lg"
            ? { alerts: realAlerts.length ? realAlerts.slice(0, 6) : paddedRows(alerts, 3), realAlerts }
            : { alerts: realAlerts.length ? realAlerts : paddedRows(alerts, 4), realAlerts };

  if (mode === "xs") return <AlertsXs {...props} />;
  if (mode === "sm") return <AlertsSm {...props} />;
  if (mode === "lg") return <AlertsLg {...props} />;
  if (mode === "xl") return <AlertsXl {...props} />;
  return <AlertsMd {...props} />;
}

