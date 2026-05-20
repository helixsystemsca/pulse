import type { PlanningIdeaPriority, PlanningIdeaStatus } from "@/lib/planning-ideas/types";

export const STATUS_LABELS: Record<PlanningIdeaStatus, string> = {
  idea: "Idea",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  deferred: "Deferred",
  rejected: "Rejected",
  converted: "Converted",
};

/** Legacy status values from older API rows — map for display. */
export function normalizePlanningStatus(status: string): PlanningIdeaStatus {
  if (status === "awaiting_approval" || status === "reviewing") return "awaiting_review";
  if ((STATUS_LABELS as Record<string, string>)[status]) return status as PlanningIdeaStatus;
  return "idea";
}

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

export function formatPipelineValue(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  return formatEstimatedCost(raw);
}
