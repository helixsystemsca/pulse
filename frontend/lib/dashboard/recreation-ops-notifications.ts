import type { OpsCommandDashboard } from "@/lib/recreation/commandService";
import {
  NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
  type OperationalNotificationItem,
} from "@/lib/dashboard/operational-notifications";

/** Personal recreation-ops exceptions for the leadership dashboard bell (not a second dashboard). */
export function recreationOpsNotificationItems(dash: OpsCommandDashboard): OperationalNotificationItem[] {
  const now = Date.now();
  const items: OperationalNotificationItem[] = [];
  let seq = 0;
  const at = () => now + ++seq;

  if (dash.checklist_overdue > 0) {
    items.push({
      id: "rec-ops-checklist-overdue",
      severity: "critical",
      priority: "critical",
      title: `${dash.checklist_overdue} overdue checklist item${dash.checklist_overdue === 1 ? "" : "s"}`,
      subtitle: "My Role · Checklists",
      eventAtMs: at(),
    });
  }
  if (dash.checklist_due_today > 0) {
    items.push({
      id: "rec-ops-checklist-today",
      severity: "warning",
      priority: "high",
      title: `${dash.checklist_due_today} checklist item${dash.checklist_due_today === 1 ? "" : "s"} due today`,
      subtitle: "My Role · Checklists",
      eventAtMs: at(),
    });
  }
  if (dash.knowledge_gaps_high > 0) {
    items.push({
      id: "rec-ops-gaps-high",
      severity: "warning",
      priority: "high",
      title: `${dash.knowledge_gaps_high} high-priority knowledge gap${dash.knowledge_gaps_high === 1 ? "" : "s"}`,
      subtitle: "My Role · Knowledge gaps",
      eventAtMs: at(),
    });
  } else if (dash.knowledge_gaps_open > 0) {
    items.push({
      id: "rec-ops-gaps-open",
      severity: "warning",
      priority: "medium",
      title: `${dash.knowledge_gaps_open} open knowledge gap${dash.knowledge_gaps_open === 1 ? "" : "s"}`,
      subtitle: "My Role · Knowledge gaps",
      eventAtMs: at(),
    });
  }
  if (!dash.profile_complete) {
    items.push({
      id: "rec-ops-profile",
      severity: "warning",
      priority: "low",
      title: "Complete your operating profile",
      subtitle: "My Role · My Profile",
      eventAtMs: at(),
    });
  }
  if (dash.authority_unknown > 0) {
    items.push({
      id: "rec-ops-authority",
      severity: "warning",
      priority: "medium",
      title: `${dash.authority_unknown} authority row${dash.authority_unknown === 1 ? "" : "s"} to confirm`,
      subtitle: "My Role · My Profile",
      eventAtMs: at(),
    });
  }
  if ((dash.open_team_risks ?? 0) > 0) {
    items.push({
      id: "rec-ops-risks",
      severity: "warning",
      priority: "high",
      title: `${dash.open_team_risks} open team risk${dash.open_team_risks === 1 ? "" : "s"}`,
      subtitle: "My Role · Team development",
      eventAtMs: at(),
    });
  }
  if ((dash.emergency_readiness_gaps ?? 0) > 0) {
    items.push({
      id: "rec-ops-emergency",
      severity: "warning",
      priority: "high",
      title: `${dash.emergency_readiness_gaps} emergency readiness gap${dash.emergency_readiness_gaps === 1 ? "" : "s"}`,
      subtitle: "My Role · Emergency",
      eventAtMs: at(),
    });
  }
  if ((dash.certs_expired ?? 0) > 0) {
    items.push({
      id: "rec-ops-certs-expired",
      severity: "critical",
      priority: "critical",
      title: `${dash.certs_expired} certification${dash.certs_expired === 1 ? "" : "s"} expired`,
      subtitle: "My Role · Certifications (in-app)",
      eventAtMs: at(),
    });
  } else if ((dash.certs_expiring_30 ?? 0) > 0) {
    items.push({
      id: "rec-ops-certs-30",
      severity: "warning",
      priority: "high",
      title: `${dash.certs_expiring_30} certification${dash.certs_expiring_30 === 1 ? "" : "s"} expiring within 30 days`,
      subtitle: "My Role · Certifications (in-app)",
      eventAtMs: at(),
    });
  }
  if ((dash.contractor_attention ?? 0) > 0) {
    items.push({
      id: "rec-ops-contractors",
      severity: "warning",
      priority: "high",
      title: `${dash.contractor_attention} contractor${dash.contractor_attention === 1 ? "" : "s"} with insurance/WCB/ticket attention`,
      subtitle: "My Role · Contractors",
      eventAtMs: at(),
    });
  }
  return items;
}

export function mergeNotificationItems(
  base: OperationalNotificationItem[],
  extra: OperationalNotificationItem[],
): OperationalNotificationItem[] {
  if (!extra.length) return base;
  const real = base.filter(
    (a) => a.countsTowardTotals !== false && a.title !== NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
  );
  return [...extra, ...real];
}
