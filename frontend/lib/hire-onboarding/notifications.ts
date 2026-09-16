import type { OperationalNotificationItem } from "@/lib/dashboard/operational-notifications";
import type { HireIncompleteSummary } from "@/lib/hireOnboardingService";

export const HIRE_ONBOARDING_LIST_HREF = "/team-management/growth/onboarding";

export function hireOnboardingPacketHref(userId: string): string {
  return `${HIRE_ONBOARDING_LIST_HREF}?hire=${encodeURIComponent(userId)}`;
}

export function hireOnboardingNotificationItems(
  summary: HireIncompleteSummary,
  nowMs = Date.now(),
): OperationalNotificationItem[] {
  if (!summary.open_hires || summary.incomplete_required_items <= 0) return [];

  const label = (row: HireIncompleteSummary["hires"][number]) =>
    row.full_name?.trim() || row.email;

  if (summary.hires.length === 1) {
    const row = summary.hires[0];
    const remaining = Math.max(0, row.required_total - row.required_completed);
    const titles = row.incomplete_titles.slice(0, 3).join(" · ");
    return [
      {
        id: `hire-onboarding-${row.user_id}`,
        severity: "warning",
        priority: "medium",
        title: `Hire documents incomplete · ${label(row)}`,
        subtitle: titles
          ? `${remaining} required remaining · ${titles}`
          : `${remaining} required document${remaining === 1 ? "" : "s"} remaining`,
        eventAtMs: nowMs,
      },
    ];
  }

  const lines = summary.hires.slice(0, 4).map((row) => {
    const remaining = Math.max(0, row.required_total - row.required_completed);
    return `${label(row)} · ${remaining} remaining`;
  });
  return [
    {
      id: "hire-onboarding-digest",
      severity: "warning",
      priority: "medium",
      title: `${summary.open_hires} open hires have incomplete required documents`,
      subtitle: lines.join("\n"),
      eventAtMs: nowMs,
    },
  ];
}
