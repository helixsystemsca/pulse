import type { PlanningIdeaPriority, PlanningIdeaStatus } from "@/lib/planning-ideas/types";

export const STATUS_LABELS: Record<PlanningIdeaStatus, string> = {
  idea: "Idea",
  reviewing: "Reviewing",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  deferred: "Deferred",
  rejected: "Rejected",
  converted: "Converted",
};

export const PRIORITY_LABELS: Record<PlanningIdeaPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function formatEstimatedCost(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    n,
  );
}
