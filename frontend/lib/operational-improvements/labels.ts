import type {
  OperationalImprovementActionStatus,
  OperationalImprovementAnalysisType,
  OperationalImprovementCategory,
  OperationalImprovementPriority,
  OperationalImprovementStatus,
} from "@/lib/operational-improvements/types";

export const STATUS_LABELS: Record<OperationalImprovementStatus, string> = {
  identified: "Identified",
  analyzing: "Analyzing",
  planning: "Planning",
  implementing: "Implementing",
  measuring: "Measuring",
  completed: "Completed",
  awaiting_review: "Awaiting review",
  archived: "Archived",
};

export const PRIORITY_LABELS: Record<OperationalImprovementPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const CATEGORY_LABELS: Record<OperationalImprovementCategory, string> = {
  inventory: "Inventory",
  procurement: "Procurement",
  communication: "Communication",
  scheduling: "Scheduling",
  maintenance: "Maintenance",
  safety: "Safety",
  quality: "Quality",
  documentation: "Documentation",
  other: "Other",
};

export const ANALYSIS_TYPE_LABELS: Record<OperationalImprovementAnalysisType, string> = {
  root_cause_5_whys: "5 Whys",
  fishbone: "Fishbone",
  process_analysis: "Process analysis",
  five_s: "5S observations",
  kanban: "Kanban opportunity",
  kaizen: "Kaizen opportunity",
  standardization: "Standardization",
};

export const ACTION_STATUS_LABELS: Record<OperationalImprovementActionStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export function statusBadgeClass(status: OperationalImprovementStatus): string {
  switch (status) {
    case "identified":
      return "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
    case "analyzing":
      return "bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100";
    case "planning":
      return "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100";
    case "implementing":
      return "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100";
    case "measuring":
      return "bg-teal-100 text-teal-950 dark:bg-teal-950/50 dark:text-teal-100";
    case "completed":
      return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "awaiting_review":
      return "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100";
    case "archived":
      return "bg-ds-secondary text-ds-muted";
    default:
      return "bg-ds-secondary text-ds-muted";
  }
}

export function priorityBadgeClass(priority: OperationalImprovementPriority): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-950 dark:bg-red-950/50 dark:text-red-100";
    case "high":
      return "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100";
    case "medium":
      return "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100";
  }
}
